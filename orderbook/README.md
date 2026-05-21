# OrderBook

This subgraph indexes the OrderBook contract from the liquidity-delivery project, tracking cross-chain order flow, fills, cancellations, and volume analytics.

## Indexed Data

- **Orders**: Creation, status changes, fills, and cancellations
- **Fills**: Individual fill events with solver attribution
- **Solvers**: Aggregated fill counts and volume statistics
- **Tokens**: Volume tracking as input/output tokens
- **Chain Routes**: Order flow between origin and destination chains
- **Refunds**: Claimed refunds after order cancellation
- **Volume Aggregations**: Hourly and daily volume statistics

## Events Indexed

| Event | Description |
|-------|-------------|
| `OrderOpened` | New order created on origin chain |
| `OrderFilled` | Order (partially) filled on destination chain |
| `OrderCompleted` | Order fully completed |
| `OrderCancelled` | Order cancelled on destination chain |
| `FillReported` | Fill reported back to origin chain |
| `CancelReported` | Cancellation reported back to origin chain |
| `RefundClaimed` | Refund claimed by sender |
| `DestinationSupportUpdated` | Destination chain support toggled |

## Deployment

Subgraphs are deployed like so:

```bash
./deploy.sh <deploy-id> <version>
```

This subgraph can be deployed to different networks by using a templating system. The deployment process is managed by the `deploy.sh` script, which uses `jq` and `mustache` to generate the final `subgraph.yaml` from a template.

### Requirements

Before deploying, you must have the following tools installed:

- `goldsky`: The Goldsky CLI for deploying subgraphs. Check the [Goldsky documentation](https://docs.goldsky.com/) for installation instructions.
- `jq`: A command-line JSON processor.

`goldsky` can be installed via npm:

```bash
npm install -g @goldskycom/cli
```

For `jq`, you can typically install it with Homebrew (macOS) or another package manager:

```bash
brew install jq
```

### Process

The `deploy.sh` script reads a deployment configuration from `networks.json` based on the deploy identifier you provide. It then uses this configuration to populate a `subgraph.template.yaml` file, generating a `subgraph.yaml` file tailored for the specific contract and network. Finally, it builds and deploys the subgraph.

### Example

To deploy the `orderbook-mainnet` configuration, run the following command:

```bash
./deploy.sh orderbook-mainnet 0.1.0
```

This will generate a `subgraph.yaml` file tailored for the specific contract and network, build the subgraph, and deploy it to the specified network.

Please bump the version number as needed.

### Supporting a new contract or chain

Add a new entry to the `networks.json` file. E.g.:

```json
{
  "orderbook-optimism": {
    "name": "OrderBook Optimism",
    "network": "optimism",
    "chainId": 10,
    "address": "0x...",
    "startBlock": 123456,
    "version": "0.1.0"
  }
}
```

Note: The `chainId` field is required for this subgraph as it tracks cross-chain orders and needs to identify the current chain.

And deploy it with:

```bash
./deploy.sh orderbook-optimism 0.1.0
```

## Example Queries

### Get orders by sender

```graphql
query OrdersBySender($sender: Bytes!) {
  orders(where: { sender: $sender }) {
    id
    status
    tokenIn
    tokenOut
    amountIn
    amountOut
    amountOutFilled
    originChainId
    destChainId
    createdAt
  }
}
```

### Get solver statistics

```graphql
query SolverStats($solver: Bytes!) {
  solver(id: $solver) {
    totalFills
    totalVolumeIn
    totalVolumeOut
    fills(first: 10, orderBy: timestamp, orderDirection: desc) {
      orderId
      amountOutFilled
      timestamp
    }
  }
}
```

### Get hourly volume stats

```graphql
query HourlyVolume {
  volumeStats_collection(interval: "hour", first: 24) {
    timestamp
    totalVolumeIn
    totalVolumeOut
    fillCount
  }
}
```

### Get chain route statistics

```graphql
query ChainRoutes {
  chainRoutes(orderBy: totalOrders, orderDirection: desc) {
    originChainId
    destChainId
    totalOrders
    totalVolumeIn
    totalVolumeOut
  }
}
```

## Testing

Run tests with:

```bash
yarn test
```

Tests cover entity helpers and core business logic. Note that timeseries entities are not fully supported by the matchstick testing framework.
