#!/bin/bash
set -e  # stop if any command fails

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

if [ -z "$1" ]; then
  echo "Missing arguments. <version>"
  exit 1
fi

VERSION="$1"

echo "🧼 Cleaning up..."
rm -rf ./build ./generated

echo "👷‍♀️ Building subgraph..."
yarn codegen
yarn build

echo "🚀 Deploying subgraph..."
goldsky subgraph deploy m-token-mainnet/"$VERSION" --path .

echo "✅ Deployment complete"
