#!/usr/bin/env bash
# Test MandateWallet: send 1 USDC to ClawdBot (agent) address.
# Requires MANDATE_AGENT_PRIVATE_KEY in env or in .env in this directory.
# Usage: ./test-transfer.sh

set -e
cd "$(dirname "$0")"
WALLET="0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d"
TO="0x530BEc993b718841dcb38d8dBdfeaEd3fC6B7897"
node execute-transfer.js "$WALLET" "$TO" 1
