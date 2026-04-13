# m-earner-spoke-network

This a subgraph indexer to index $M token on "Spoke networks".

On Spoke networks, we don't push the rate on `IndexUpdate` events. All Ethereum L2s, Hyperliquid and Solana base their yield accrual on the bridged index updates only.

Check the examples in the [`scripts` folder](./scripts/) to learn how to compute accrued yield.

⚠️ Heads-up: even though this indexer provides a stateful `lastIndex` (derived from rates + index updates), we suggest not to rely on it for yield accrual unless the network you are interested in, hasn't seen any $M earner rate change since deployed. You can check our [Governance](https://governance.m0.org/config/protocol) for the latest changes. If in doubt, use `Holder.claimed` + `StablecoinContract.yield()` (unclaimed) for a safer accrued yield amount.

## Deployments

Per-network configuration (chain, $M start block, tracked stablecoin address, stablecoin start block) lives in [`networks.json`](./networks.json). The `subgraph.yaml` used by `graph build` is generated from [`subgraph.template.yaml`](./subgraph.template.yaml) via Mustache at deploy time.

### How to deploy

Deploy to Goldsky with:

```sh
yarn deploy <deploy-id> <version>
```

For example:

```sh
yarn deploy m-token-linea 1.0.1
```

`<deploy-id>` must be a key from `networks.json`. This will also be the Goldsky subgraph name. Currently supported:

- `m-token-linea` — $M on Linea, tracking mUSD yield.
- `m-token-hyperevm` — $M on Hyperliquid, tracking USDhl yield.

### How to add a new spoke network

1. Add a new entry in [`networks.json`](./networks.json) with a unique `<deploy-id>` key and fill in:
   - `name` — human readable description.
   - `network` — Goldsky-supported chain name (see [docs](https://docs.goldsky.com/subgraphs/blocks-subgraphs#supported-networks)).
   - `mTokenStartBlock` — block height at which the $M contract was created on that chain.
   - `stablecoinAddress` — address of the stablecoin whose yield you want to track.
   - `stablecoinStartBlock` — block height at which the stablecoin was created.
   - `version` — initial version (e.g., `0.1.0`).
2. Run `yarn deploy <deploy-id> <version>`.
