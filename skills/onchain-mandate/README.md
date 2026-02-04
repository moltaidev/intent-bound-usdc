# On-Chain Mandate skill

Execute USDC through a **MandateWallet** on Base Sepolia. The contract enforces cap per period and optional allowlist on-chain; the agent can only trigger `executeTransfer`, and the chain enforces the rules.

## Prerequisites

1. Deploy a **MandateWallet** (see repo `contracts/`): `forge script script/DeployMandateWallet.s.sol --rpc-url <RPC> --broadcast`
2. As **owner**, set the mandate: `setMandate(maxPerPeriod, periodSeconds, allowedRecipients)` and set the agent: `setAgent(agentAddress)`.
3. Fund the MandateWallet with USDC (testnet).
4. Add **.onchain-mandate.json** in the workspace (see SKILL.md) and set **MANDATE_AGENT_PRIVATE_KEY** in env (agent's key, not owner's).

## What the agent can do

- **Execute transfers:** "Send 10 USDC to 0x..." → agent calls `executeTransfer(to, amount)`; contract reverts if over cap or recipient not allowed.
- **Report status:** Agent can read `usedThisPeriod`, `maxPerPeriod`, `getAllowedRecipients()` from the contract and report to the user.

## What the agent cannot do

- Set or change the mandate (owner only).
- Spend over the cap or to a non-allowlisted address (contract reverts).

## Files

| File | Purpose |
|------|--------|
| SKILL.md | Agent instructions (config, executeTransfer, security). |
| execute-transfer.js | Script to run executeTransfer (optional; agent can use viem in code). |
| .onchain-mandate.json.example | Example config; copy to workspace and set walletAddress + agentPrivateKeyEnv. |

## Testnet only

Base Sepolia + testnet USDC only. Do not use for mainnet without explicit user acceptance.
