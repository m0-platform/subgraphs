# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing GraphQL subgraph indexers for the M Protocol ecosystem. Subgraphs use The Graph protocol to index blockchain events and provide queryable on-chain data for stablecoins (M Token, Wrapped M), governance (TTG), and related contracts across Ethereum mainnet and L2 networks.

## Build Commands

Each subgraph is independent with its own `package.json`. Navigate to a subgraph directory first:

```bash
cd <subgraph-name>
yarn install        # Install dependencies
yarn codegen        # Generate GraphQL types from schema
yarn build          # Compile the subgraph
yarn test           # Run tests (matchstick-as framework)
```

For subgraphs with prettier configured:
```bash
yarn prettier       # Format TypeScript files
```

## Deployment

**Single-network subgraphs** (protocol, erc20, ttg, etc.):
```bash
yarn deploy:mainnet   # Uses .env for DEPLOY_KEY and VERSION_LABEL
```

**Multi-network subgraphs** (stablecoin, stateful-l2-wrapped-m-token, etc.):
```bash
./deploy.sh <deploy-id> <version>   # e.g., ./deploy.sh musd-mainnet 0.1.0
```

Requires `jq` and `goldsky` CLI. Configuration is in `networks.json`.

## Architecture

For a detailed explanation of how subgraph indexers work (the pipeline from raw event logs to queryable data), see [docs/subgraph-architecture.md](docs/subgraph-architecture.md).

**Subgraph Structure:**
- `src/` - AssemblyScript event handlers
- `abis/` - Contract ABIs
- `tests/` - Matchstick test files (`*.test.ts`)
- `schema.graphql` - GraphQL entity definitions
- `subgraph.yaml` - Main configuration (or `subgraph.template.yaml` for templated deployments)
- `networks.json` - Network-specific contract addresses and start blocks

**Subgraphs by Category:**

| Category | Subgraphs |
|----------|-----------|
| Core Protocol | `protocol`, `erc20`, `ttg` |
| Stateful Indexers | `stateful-m-token`, `stateful-wrapped-m-token`, `stateful-minter-gateway`, `stateful-l2-wrapped-m-token` |
| Multi-Contract | `stablecoin`, `m-earner-spoke-network` |
| Specialized | `minter-module`, `superstate` |

**Event-Driven Pattern:** Handlers in `src/` process contract events and store data in GraphQL entities. Some subgraphs use block handlers for periodic tasks (e.g., daily rate snapshots).

## Testing

Uses matchstick-as framework with describe/test/assert pattern:
```bash
yarn test                    # Run all tests
graph test <test-file>       # Run specific test file
```

Test utilities create mock events (e.g., `tests/*-utils.ts`).

## Code Style

- Prettier: single quotes, trailing commas (es5), 120 char width, 4-space tabs
- EditorConfig: 2-space indent, LF line endings, UTF-8

## Version Notes

Older subgraphs (protocol, erc20, ttg) use graph-cli 0.73.0. Newer stateful subgraphs require Node.js >=23.2.0 and use graph-cli 0.88.0+.

## Local Development

```bash
docker-compose up             # Start local graph-node
yarn create-local             # Create local subgraph
yarn deploy-local             # Deploy to local node
# Query at http://localhost:8000
```

## Creating New Indexers

See [docs/subgraph-architecture.md](docs/subgraph-architecture.md) for:
- How the indexing pipeline works (ABI → manifest → handlers → schema)
- Schema patterns (entities, timeseries, aggregations)
- Handler patterns (mint/burn detection, holder tracking, singletons)
- Multi-chain deployment using templating (see `stablecoin/` as reference)
