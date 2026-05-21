# Subgraph Architecture Guide

This guide explains how subgraph indexers work - the pipeline from raw Ethereum event logs to queryable GraphQL data.

## Overview

```
┌─────────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Ethereum Node  │───▶│  Graph Node │───▶│   Handlers   │───▶│  PostgreSQL │
│  (event logs)   │    │  (decoder)  │    │ (your code)  │    │  (storage)  │
└─────────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                              │                   │
                              ▼                   ▼
                         ┌─────────┐        ┌──────────┐
                         │   ABI   │        │  Schema  │
                         └─────────┘        └──────────┘
```

## 1. The ABI - Event Signature Decoding

The ABI tells the Graph Node how to decode raw log data into typed parameters.

**Raw event log on-chain:**
```
topics[0]: 0xddf252ad...  (keccak256 of "Transfer(address,address,uint256)")
topics[1]: 0x000...abc123  (indexed sender)
topics[2]: 0x000...def456  (indexed recipient)
data:      0x000...1e18    (amount)
```

**ABI definition:**
```json
{
  "inputs": [
    { "indexed": true, "name": "sender", "type": "address" },
    { "indexed": true, "name": "recipient", "type": "address" },
    { "indexed": false, "name": "amount", "type": "uint256" }
  ],
  "name": "Transfer",
  "type": "event"
}
```

The Graph Node matches `topics[0]` to the event signature, then decodes indexed parameters from topics and non-indexed from data.

**Key rules:**
- `indexed` parameters go in topics (max 3 indexed params per event)
- Non-indexed parameters are ABI-encoded in the data field
- Event signature must match exactly between ABI and manifest

## 2. The Manifest (`subgraph.yaml`) - Routing Events to Handlers

The manifest tells the Graph Node what to index and how.

```yaml
specVersion: 1.2.0
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: MyContract
    network: mainnet
    source:
      address: "0x1234..."
      abi: MyContract
      startBlock: 12345678
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Transfer
        - Account
      abis:
        - name: MyContract
          file: ./abis/MyContract.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTransfer
        - event: YieldClaimed(uint256)
          handler: handleYieldClaimed
          calls:
            MyContract.yield: MyContract[event.address].yield()
      blockHandlers:
        - handler: handleBlock
      file: ./src/mapping.ts
```

**Key sections:**

| Section | Purpose |
|---------|---------|
| `source.address` | Contract address to watch |
| `source.startBlock` | Block to start indexing from (saves sync time) |
| `eventHandlers` | Maps event signatures to handler functions |
| `calls` | Pre-fetches contract state before handler runs (eth_call batching) |
| `blockHandlers` | Runs on every block (for periodic snapshots) |
| `entities` | List of schema entities this data source writes to |

**Event signature format:**
- Must match ABI exactly: `EventName(type1,type2,...)`
- Include `indexed` keyword for indexed params: `Transfer(indexed address,indexed address,uint256)`
- Use Solidity types: `address`, `uint256`, `bytes32`, etc.

## 3. Generated Types - Type-Safe Event Objects

Running `yarn codegen` generates TypeScript types from the ABI and schema.

**Generated event class (from ABI):**
```typescript
// generated/MyContract/MyContract.ts
export class Transfer extends ethereum.Event {
  get params(): Transfer__Params {
    return new Transfer__Params(this);
  }
}

export class Transfer__Params {
  get sender(): Address { ... }
  get recipient(): Address { ... }
  get amount(): BigInt { ... }
}
```

**Generated entity class (from schema):**
```typescript
// generated/schema.ts
export class Account extends Entity {
  constructor(id: Bytes) { ... }
  save(): void { ... }
  static load(id: Bytes): Account | null { ... }

  get id(): Bytes { ... }
  get balance(): BigInt { ... }
  set balance(value: BigInt) { ... }
}
```

**Important:** Always run `yarn codegen` after changing the schema or ABIs.

## 4. The Schema (`schema.graphql`) - Data Model Definition

Defines what gets stored and how it can be queried.

### Entity Types (Mutable)

Loaded by ID, can be updated over time:

```graphql
type Account @entity {
  id: Bytes!              # Primary key (usually address)
  balance: BigInt!
  transferCount: Int!
  lastUpdate: Timestamp!
}
```

### Immutable Entities

Cannot be modified after creation (better performance):

```graphql
type Transfer @entity(immutable: true) {
  id: Bytes!              # Usually txHash + logIndex
  from: Account!
  to: Account!
  amount: BigInt!
  timestamp: BigInt!
}
```

### Timeseries Types (Append-Only)

Auto-timestamped, ideal for historical data:

```graphql
type TransferSnapshot @entity(timeseries: true) {
  id: Int8!               # Auto-generated
  timestamp: Timestamp!   # Auto-populated from block
  sender: Bytes!
  recipient: Bytes!
  amount: BigInt!
}
```

### Aggregation Types (Auto-Computed)

Automatically aggregated from timeseries sources:

```graphql
type VolumeStats @aggregation(intervals: ["hour", "day"], source: "TransferSnapshot") {
  id: Int8!
  timestamp: Timestamp!
  amount: BigDecimal! @aggregate(fn: "sum", arg: "amount")
  count: Int8! @aggregate(fn: "count", cumulative: true)
}
```

**Aggregation functions:** `sum`, `count`, `min`, `max`, `first`, `last`

### Derived Fields

Create reverse lookups without storing data:

```graphql
type Account @entity {
  id: Bytes!
  transfers: [Transfer!]! @derivedFrom(field: "from")
}
```

## 5. The Handler - Transformation Logic

Handlers transform events into stored entities.

```typescript
import { Transfer as TransferEvent } from "../generated/MyContract/MyContract"
import { Account, Transfer } from "../generated/schema"
import { Bytes, BigInt } from "@graphprotocol/graph-ts"

export function handleTransfer(event: TransferEvent): void {
  // 1. Load or create entities
  let from = Account.load(event.params.sender)
  if (from == null) {
    from = new Account(event.params.sender)
    from.balance = BigInt.fromI32(0)
    from.transferCount = 0
  }

  let to = Account.load(event.params.recipient)
  if (to == null) {
    to = new Account(event.params.recipient)
    to.balance = BigInt.fromI32(0)
    to.transferCount = 0
  }

  // 2. Update state
  from.balance = from.balance.minus(event.params.amount)
  from.transferCount += 1
  to.balance = to.balance.plus(event.params.amount)
  to.transferCount += 1

  // 3. Persist entities (required!)
  from.save()
  to.save()

  // 4. Create immutable transfer record
  let transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  transfer.from = from.id
  transfer.to = to.id
  transfer.amount = event.params.amount
  transfer.timestamp = event.block.timestamp
  transfer.save()
}
```

**Key patterns:**

| Pattern | Usage |
|---------|-------|
| `Entity.load(id)` | Load existing entity (returns null if not found) |
| `new Entity(id)` | Create new entity |
| `entity.save()` | Persist to store (required for changes) |
| `event.params.*` | Access decoded event parameters |
| `event.block.*` | Access block metadata (number, timestamp, hash) |
| `event.transaction.*` | Access transaction metadata (hash, from, to) |

**Common ID patterns:**
- Address as ID: `event.params.account` (Bytes)
- Composite ID: `event.transaction.hash.concatI32(event.logIndex.toI32())`
- String ID: `event.params.account.toHexString()`

## 6. Block Handlers - Periodic State Capture

For data not emitted as events (e.g., accrued yield, rates):

```typescript
export function handleBlock(block: ethereum.Block): void {
  // Throttle to once per hour
  let currentHour = block.timestamp.toI32() / 3600
  let meta = Meta.load("singleton")
  if (meta == null) {
    meta = new Meta("singleton")
    meta.lastHour = 0
  }
  if (meta.lastHour == currentHour) return

  // Fetch current contract state
  let contract = MyContract.bind(dataSource.address())
  let currentRate = contract.getRate()

  // Create snapshot
  let snapshot = new RateSnapshot(block.number.toString())
  snapshot.rate = currentRate
  snapshot.blockNumber = block.number
  snapshot.timestamp = block.timestamp
  snapshot.save()

  // Update throttle tracker
  meta.lastHour = currentHour
  meta.save()
}
```

**Warning:** Block handlers run on every block and can slow indexing significantly. Always throttle them.

## 7. Contract Calls - Reading On-Chain State

You can call contract view functions from handlers:

```typescript
import { MyContract } from "../generated/MyContract/MyContract"

export function handleSomeEvent(event: SomeEvent): void {
  // Bind to contract at event address
  let contract = MyContract.bind(event.address)

  // Call view function
  let result = contract.try_balanceOf(event.params.account)

  if (!result.reverted) {
    let balance = result.value
    // Use balance...
  }
}
```

**Best practice:** Use `try_*` methods to handle potential reverts gracefully.

**Pre-fetching with `calls:`** in manifest (more efficient):
```yaml
eventHandlers:
  - event: YieldClaimed(uint256)
    handler: handleYieldClaimed
    calls:
      MyContract.yield: MyContract[event.address].yield()
```

## 8. Querying the Data

After indexing, data is queryable via GraphQL:

```graphql
# Get top holders
query {
  accounts(first: 10, orderBy: balance, orderDirection: desc) {
    id
    balance
    transferCount
  }
}

# Get recent transfers
query {
  transfers(first: 100, orderBy: timestamp, orderDirection: desc) {
    from { id }
    to { id }
    amount
    timestamp
  }
}

# Get hourly volume (auto-aggregated)
query {
  volumeStats_collection(interval: "hour", first: 24) {
    timestamp
    amount
    count
  }
}
```

## Summary: The Full Flow

1. **Contract emits event** → Raw log with topics + data
2. **Graph Node receives log** → Matches event signature from manifest
3. **ABI decodes log** → Typed parameters (sender, recipient, amount)
4. **Handler receives typed event** → Your code in `src/mapping.ts`
5. **Handler loads/creates entities** → Using generated schema classes
6. **Handler transforms and saves** → Business logic + `entity.save()`
7. **Graph Node persists to Postgres** → Entities stored by ID
8. **GraphQL API serves queries** → Users query the indexed data

## Common Patterns in This Repository

### Mint/Burn Detection
```typescript
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")

if (event.params.from.equals(ZERO_ADDRESS)) {
  // This is a mint
} else if (event.params.to.equals(ZERO_ADDRESS)) {
  // This is a burn
} else {
  // Regular transfer
}
```

### Holder Count Tracking
```typescript
// Track when holders join (balance goes from 0 to >0)
if (prevBalance.equals(ZERO) && newBalance.gt(ZERO)) {
  stats.holdersCount += 1
}
// Track when holders leave (balance goes from >0 to 0)
if (prevBalance.gt(ZERO) && newBalance.equals(ZERO)) {
  stats.holdersCount -= 1
}
```

### Singleton Entities
```typescript
let config = Config.load("singleton")
if (config == null) {
  config = new Config("singleton")
  config.someValue = BigInt.fromI32(0)
}
```

### Helper Functions for Entity Creation
```typescript
function getOrCreateAccount(address: Bytes): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.balance = BigInt.fromI32(0)
    account.save()
  }
  return account
}
```
