---
name: onchain-mandate
description: Execute USDC transfers through an on-chain MandateWallet (Base Sepolia). The contract enforces cap per period and optional allowlist; only the agent key can trigger executeTransfer. Use when the user has deployed a MandateWallet and wants to pay within the on-chain mandate.
metadata: {"openclaw":{"emoji":"⛓️","homepage":"https://github.com/moltaidev/usdc-mandate","always":false}}
---

# On-Chain Mandate (MandateWallet)

This skill lets the agent **execute USDC transfers** through a **MandateWallet** contract on **Base Sepolia**. The contract enforces a spending cap per period and an optional allowlist on-chain; even a compromised agent cannot exceed the mandate.

**Prerequisites:** The user must have deployed a MandateWallet (see `contracts/` in the repo), set the mandate (max per period, allowlist) as owner, and configured the agent key in the workspace config.

---

## Config file

**Path:** `{workspace}/.onchain-mandate.json`

Example:

```json
{
  "chainId": 84532,
  "rpcUrl": "https://sepolia.base.org",
  "walletAddress": "0x...",
  "usdcAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "agentPrivateKeyEnv": "MANDATE_AGENT_PRIVATE_KEY"
}
```

| Field | Description |
|-------|-------------|
| `chainId` | 84532 for Base Sepolia |
| `rpcUrl` | RPC endpoint |
| `walletAddress` | MandateWallet contract address |
| `usdcAddress` | USDC token (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| `agentPrivateKeyEnv` | Env var name holding the agent's private key (never put the key in the file) |

The agent private key must be the address set as `agent` on the MandateWallet (via `setAgent`). Only that key can call `executeTransfer`.

---

## When the user asks to send USDC (on-chain mandate)

1. **Read** `.onchain-mandate.json` from the workspace. If missing, tell the user: "No on-chain mandate config. Deploy a MandateWallet (see repo contracts/), set the mandate as owner, and add .onchain-mandate.json with walletAddress and agentPrivateKeyEnv."
2. **Resolve** the agent private key from the environment variable named in `agentPrivateKeyEnv`. If not set, tell the user to set it (e.g. in `~/.openclaw/.env`).
3. **Call** `executeTransfer(to, amount)` on the MandateWallet:
   - `to` = recipient address (must be in the contract's allowlist if allowlist is set)
   - `amount` = USDC amount in **smallest units** (6 decimals: 10 USDC = 10_000_000)
4. Use the provided script `execute-transfer.js` with args `to` and `amountUsdc` (in human units), or use viem/ethers in code: create a wallet from the agent key, call `wallet.executeTransfer(to, amount)` on the contract.
5. If the tx reverts, report the reason: `RecipientNotAllowed`, `ExceedsMandate`, or other.
6. On success, report the tx hash and explorer link (e.g. `https://sepolia.basescan.org/tx/...`).

**Security:** Never log or expose the agent private key. Never use the owner key in the skill; the owner sets the mandate outside the agent (e.g. via Safe or wallet UI).

---

## Setting the mandate (owner only)

The **owner** of the MandateWallet sets the mandate (not the agent). The agent must not hold the owner key.

- If the user says "Set on-chain mandate to 50 USDC per week, only 0xABC and 0xDEF", tell them: "Only the wallet owner can set the mandate. Use the contract's setMandate(maxPerPeriod, periodSeconds, allowedRecipients). Example: maxPerPeriod = 50e6, periodSeconds = 604800, allowedRecipients = [0xABC..., 0xDEF...]. Sign with the owner key (e.g. via Safe or wallet)."
- Optionally, provide a `set-mandate.js` script or cast commands they can run as owner.

---

## Contract ABI (for executeTransfer)

The agent or script needs the contract ABI. Minimal ABI for `executeTransfer`:

```json
[
  {"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"name":"executeTransfer","outputs":[],"stateMutability":"nonpayable","type":"function"}
]
```

---

## Testnet only

This skill is for **Base Sepolia** and testnet USDC only. Do not use for mainnet or real funds unless the user has explicitly configured and accepted risk.
