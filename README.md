# Intent-bound USDC — agent-native finance

**What this is:** A project (not a single skill) that gives you **bounded USDC spending** for AI agents. It has two OpenClaw **skills** + **smart contracts** on Base Sepolia. You can use the policy layer only, the on-chain layer only, or both.

**Two layers:**

| Layer | What it does | Where |
|-------|----------------|-------|
| **Policy** | Agent checks user-set rules (cap, whitelist) before any USDC payment; refuses if violated. | [skills/usdc-mandate](skills/usdc-mandate) |
| **On-chain** | Smart contract enforces cap + allowlist; only the agent can call `executeTransfer`; chain reverts if over mandate. | [contracts](contracts) + [skills/onchain-mandate](skills/onchain-mandate) |

Policy = fast, flexible rules in the agent. On-chain = **verifiable** limits even if the agent is compromised.

---

## How it works

1. **You set a mandate** — e.g. “50 USDC per week, these addresses only.” Policy skill stores it in the workspace; on-chain you call `setMandate()` on the contract (owner only).
2. **You fund** — For on-chain: send USDC to the MandateWallet contract. For policy-only: agent uses its own wallet within mandate rules.
3. **Agent sends USDC** — Policy skill: agent checks mandate + ledger before each send and refuses if over cap or wrong recipient. On-chain skill: agent calls `executeTransfer(to, amount)`; contract reverts if the transfer would break the mandate.
4. **Result** — Same rules (cap + whitelist) are enforced in the agent (policy) and/or by the contract (on-chain). Compromised agent still can’t exceed what you set.

---

## Quick links

- **USDC mandate (policy):** [skills/usdc-mandate](skills/usdc-mandate) — mandate + ledger in workspace; agent checks before every send. Also on GitHub: [moltaidev/usdc-mandate](https://github.com/moltaidev/usdc-mandate).
- **MandateWallet (on-chain):** [contracts](contracts) — Solidity on Base Sepolia; [skills/onchain-mandate](skills/onchain-mandate) — OpenClaw skill to run `executeTransfer`.
- **Design:** [docs/ONCHAIN_MANDATE_DESIGN.md](docs/ONCHAIN_MANDATE_DESIGN.md), [docs/ONCHAIN_MANDATE_NEXT_STEPS.md](docs/ONCHAIN_MANDATE_NEXT_STEPS.md).

---

## Repo layout

```
contracts/          # MandateWallet.sol (Foundry), deploy script, tests
docs/               # Design + next steps
skills/
  usdc-mandate/     # Policy-layer skill (mandate + ledger)
  onchain-mandate/  # On-chain skill (execute-transfer.js, SKILL.md)
scripts/            # AWS/OpenClaw setup (no secrets committed)
```

---

## Testnet

Base Sepolia (chain id 84532). USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Testnet only; do not use for mainnet without explicit acceptance.
