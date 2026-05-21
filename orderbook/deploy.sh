#!/bin/bash
set -e

#
# This script deploys a Goldsky subgraph for the OrderBook project.
# It requires two arguments: deploy-id and version.
#
# ```bash
# ./deploy.sh deploy-id new-version
# ```
#
# The information for the deployment (network, address, startBlock) is read from networks.json based
# on the deploy-id.
#


# Check for dependencies: jq and goldsky
if ! command -v jq &> /dev/null; then
  echo "jq is required. Please install it."
  echo "e.g., 'brew install jq'"
  exit 1
fi
if ! command -v goldsky &> /dev/null; then
  echo "goldsky is required. Please install it."
  echo "e.g., 'npm install -g @goldskycom/cli'"
  exit 1
fi

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Missing arguments. Usage: $0 <deploy-id> <version>"
  echo "  <deploy-id> is a key from networks.json (e.g., orderbook-mainnet)"
  exit 1
fi

DEPLOY_ID="$1"
VERSION="$2"

# Read config from networks.json using jq
CONFIG=$(jq -r ".[\"$DEPLOY_ID\"]" networks.json)
if [ "$CONFIG" == "null" ]; then
  echo "Huh, could not find deploy ID '$DEPLOY_ID' in networks.json"
  exit 1
fi

NETWORK=$(echo "$CONFIG" | jq -r '.network')
ADDRESS=$(echo "$CONFIG" | jq -r '.address')
START_BLOCK=$(echo "$CONFIG" | jq -r '.startBlock')
CHAIN_ID=$(echo "$CONFIG" | jq -r '.chainId')
NAME=$(echo "$CONFIG" | jq -r '.name')

echo "🧼 Cleaning up..."
rm -rf ./build ./generated

echo "📝 Generating subgraph.yaml from template for $NAME on $NETWORK (chainId: $CHAIN_ID), version $VERSION..."
# Create a JSON object for mustache from the variables
MUSTACHE_JSON=$(jq -n \
  --arg network "$NETWORK" \
  --arg address "$ADDRESS" \
  --arg startBlock "$START_BLOCK" \
  --arg chainId "$CHAIN_ID" \
  '{network: $network, address: $address, startBlock: $startBlock, chainId: $chainId}')

echo "$MUSTACHE_JSON" | ./node_modules/.bin/mustache - subgraph.template.yaml > subgraph.yaml

echo "👷‍♀️ Building..."
yarn codegen
yarn build

echo "🚀 Deploying subgraph..."
goldsky subgraph deploy "$DEPLOY_ID"/"$VERSION" --path .

# Sync version in package.json and networks.json
npm version "$VERSION" --no-git-tag-version --allow-same-version > /dev/null
jq --arg deploy_id "$DEPLOY_ID" --arg version "$VERSION" '.[$deploy_id].version = $version' networks.json > tmp.$$.json && mv tmp.$$.json networks.json

echo "✅ Deployment complete"
