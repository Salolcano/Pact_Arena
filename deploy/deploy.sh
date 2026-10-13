#!/usr/bin/env bash
# Deploys contracts/pact_arena.py to GenLayer Studio and writes the address
# into frontend/.env so the website points at the new contract.
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-studio}"

if ! command -v genlayer >/dev/null 2>&1; then
  echo "Install the CLI first: npm install -g genlayer" >&2
  exit 1
fi

genlayer network set "$NETWORK"
OUTPUT="$(genlayer deploy --contract contracts/pact_arena.py)"
echo "$OUTPUT"

ADDRESS="$(echo "$OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | tail -n1 || true)"
if [ -z "$ADDRESS" ]; then
  echo "Could not find the contract address in the deploy output." >&2
  exit 1
fi

printf 'VITE_PACT_ADDRESS=%s\nVITE_NETWORK=%s\n' "$ADDRESS" "$NETWORK" > frontend/.env
echo "Contract deployed at $ADDRESS and written to frontend/.env"
