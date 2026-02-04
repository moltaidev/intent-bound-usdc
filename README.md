# Intent-bound USDC — agent-native finance

Two layers for programmable, bounded USDC spending with AI agents:

| Layer | What it does | Where |
|-------|----------------|-------|
| **Policy** | Agent checks user-set rules (cap, whitelist) before any USDC payment; refuses if violated. | [skills/usdc-mandate](skills/usdc-mandate) |
| **On-chain** | Smart contract enforces cap + allowlist; only the agent can call `executeTransfer`; chain reverts if over mandate. | [contracts](contracts) + [skills/onchain-mandate](skills/onchain-mandate) |

Policy gives fast, flexible rules in the agent; on-chain gives **verifiable** limits even if the agent is compromised.

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
