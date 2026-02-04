# MandateWallet (On-Chain USDC Mandate)

Smart contract that enforces USDC spending rules on-chain: cap per period + optional allowlist. Only the designated **agent** can call `executeTransfer`; the contract reverts if the transfer would exceed the mandate.

**Network:** Base Sepolia (chain id 84532).  
**USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle testnet).

## Build & test

```bash
forge build
forge test
```

## Deploy (Base Sepolia)

```bash
export MANDATE_OWNER=0xYourOwnerAddress
export MANDATE_AGENT=0xYourAgentAddress
forge script script/DeployMandateWallet.s.sol --rpc-url https://sepolia.base.org --broadcast --private-key $OWNER_PRIVATE_KEY
```

Then as owner: fund the wallet with USDC, call `setMandate(maxPerPeriod, periodSeconds, allowedRecipients)` and `setAgent(agentAddress)` if not set in script.

## Contract interface

- `setAgent(address)` — owner sets the address that can call `executeTransfer`
- `setMandate(uint256 maxPerPeriod, uint256 periodSeconds, address[] allowedRecipients)` — owner sets cap and optional allowlist (empty array = any recipient)
- `executeTransfer(address to, uint256 amount)` — agent sends USDC; contract enforces mandate
- `withdraw(address to, uint256 amount)` — owner emergency withdraw

See `docs/ONCHAIN_MANDATE_DESIGN.md` for full design.
