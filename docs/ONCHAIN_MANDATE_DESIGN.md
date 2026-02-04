# On-Chain Mandate Design (MandateWallet v1)

**Goal:** Enforce USDC spending rules on-chain so a compromised or misbehaving agent cannot exceed the mandate. Complements the existing `usdc-mandate` skill (policy layer) with a **verifiable** layer.

---

## 1. Threat model

| Threat | Policy-only (skill) | On-chain mandate |
|--------|---------------------|------------------|
| Agent ignores instructions | Can spend anyway | Contract reverts |
| Agent key leaked | Can spend without limit | Cap + allowlist enforced by contract |
| User wants audit trail | Ledger file can be altered | Events on-chain |

**Scope (v1):** Single owner, single agent (delegate). Owner sets mandate; agent can only trigger transfers that pass the mandate. Testnet (Base Sepolia) only.

---

## 2. Policy encoding (on-chain state)

Stored in the contract:

| Field | Type | Description |
|-------|------|--------------|
| `maxPerPeriod` | uint256 | Max USDC (6 decimals) allowed per period |
| `period` | uint256 | Period length in seconds (e.g. 604800 = 1 week) |
| `periodStart` | uint256 | Unix timestamp when current period started |
| `usedThisPeriod` | uint256 | USDC already spent in current period |
| `allowedRecipients` | address[] | If length > 0, only these addresses can receive; if 0, any address |
| `token` | address | ERC-20 token (USDC) |
| `owner` | address | Can set mandate and withdraw |
| `agent` | address | Can call `executeTransfer` (session key / delegate) |

Period rollover: when `block.timestamp >= periodStart + period`, contract treats as new period (reset `usedThisPeriod` to 0 for the next period; we do this lazily in the same tx that executes a transfer).

---

## 3. Contract interface

### MandateWallet.sol (minimal)

```text
constructor(address _owner, address _token)
setAgent(address _agent) onlyOwner
setMandate(uint256 maxPerPeriod, uint256 periodSeconds, address[] allowedRecipients) onlyOwner
executeTransfer(address to, uint256 amount) onlyAgent  // checks mandate, transfers USDC
withdraw(address to, uint256 amount) onlyOwner        // emergency / drain
```

**Checks in `executeTransfer`:**
1. If `allowedRecipients.length > 0`, require `to` in list.
2. Lazy period rollover: if `block.timestamp >= periodStart + period`, set `periodStart = block.timestamp`, `usedThisPeriod = 0`.
3. Require `usedThisPeriod + amount <= maxPerPeriod`.
4. `usedThisPeriod += amount`.
5. `IERC20(token).transfer(to, amount)`.

**Events:** `MandateSet`, `TransferExecuted(address to, uint256 amount, uint256 usedThisPeriod)`.

---

## 4. Network and addresses

| Item | Value |
|------|--------|
| Chain | Base Sepolia |
| Chain ID | 84532 |
| RPC | https://sepolia.base.org |
| USDC | 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Circle testnet) |
| Explorer | https://sepolia.basescan.org |

---

## 5. OpenClaw skill: `onchain-mandate`

- **Config file (workspace):** `.onchain-mandate.json` — chainId, walletAddress, agentPrivateKey (or agent address if we use relayer), USDC address.
- **Flow:**
  1. User: "Set on-chain mandate: 50 USDC per week, only 0xABC..."
  2. Skill compiles to `setMandate(50e6, 604800, [0xABC...])` and calls from owner (or prompts user to sign).
  3. User: "Send 10 USDC to 0xABC"
  4. Skill calls `executeTransfer(0xABC, 10e6)` from agent key; contract enforces and emits event.
- **Security:** Agent private key only used for `executeTransfer`; owner key never in skill. Owner sets mandate via wallet UI or separate signed tx.

---

## 6. Phase 2 (future)

- ERC-4337 account + MandateHook (modular, composable with other modules).
- Multiple agents with different caps.
- CCTP / cross-chain mandate (read-only policy on L1, execute on L2).

---

## 7. References

- [Base Spend Permissions](https://docs.base.org/identity/smart-wallet/guides/spend-limits/)
- [Safe Allowance Module (AI agent spending limit)](https://docs.safe.global/home/ai-agent-quickstarts/agent-with-spending-limit)
- [ERC-7579 Modules](https://erc7579.com/modules) (SpendingLimitHook, etc.)
