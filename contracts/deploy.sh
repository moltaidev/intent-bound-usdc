#!/usr/bin/env bash
# Deploy MandateWallet to Base Sepolia.
# Requires: .env with DEPLOYER_PRIVATE_KEY (account with testnet ETH)
# Optional: MANDATE_OWNER, MANDATE_AGENT (defaults to deployer)

set -e
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  echo "Set DEPLOYER_PRIVATE_KEY in .env (or export it)."
  echo "Copy .env.example to .env and add your key."
  exit 1
fi

echo "Deploying MandateWallet to Base Sepolia..."
forge script script/DeployMandateWallet.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --private-key "$DEPLOYER_PRIVATE_KEY"

echo ""
echo "Done. Add the deployed wallet address to your .onchain-mandate.json (walletAddress)."
echo "Then fund the wallet with testnet USDC and call setMandate as owner."
