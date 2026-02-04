# On-Chain Mandate — Next Steps

## Deployed MandateWallet (Base Sepolia)

- **Contract:** `0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d`
- **Owner & agent:** ClawdBot’s address (`0x530BEc993b718841dcb38d8dBdfeaEd3fC6B7897`)
- **Mandate:** 50 USDC per 604800 seconds (7 days), any recipient (empty allowlist)

ClawdBot on EC2 already has `~/.openclaw/workspace/.onchain-mandate.json` and `MANDATE_AGENT_PRIVATE_KEY` set.

---

## 1. Fund the MandateWallet with USDC

Send **Base Sepolia testnet USDC** to the contract address:

```
0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d
```

- **USDC (testnet):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` on Base Sepolia  
- Get testnet USDC from a [Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet) or Circle’s testnet flow if needed.

After sending, verify balance from the repo:

```bash
cd skills/onchain-mandate
node check-balance.js 0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d
```

---

## 2. Test the onchain-mandate skill with ClawdBot

1. **SSH to the EC2 instance** where OpenClaw/ClawdBot runs.

2. **Ask ClawdBot** (in the same workspace where `.onchain-mandate.json` lives), for example:
   - “Send 1 USDC to \<some Base Sepolia address\>”
   - “What’s my MandateWallet USDC balance?” / “How much have I used this period?”

3. **Expected behavior:**
   - If the amount is ≤ 50 USDC and within the 7-day window, the agent uses the skill, calls `executeTransfer`, and the tx succeeds.
   - If over cap or to a disallowed recipient, the contract reverts and the agent should report the error.

4. **Optional — run the script by hand** (on a machine with `MANDATE_AGENT_PRIVATE_KEY` and the same config):

   ```bash
   node execute-transfer.js 0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d <toAddress> 1
   ```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Send Base Sepolia USDC to `0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d` |
| 2 | Run `node check-balance.js 0x1BC4d54Fb7a8610dc6e06BC2DD049Dd45673821d` to confirm |
| 3 | On EC2, ask ClawdBot to “send X USDC to Y” and confirm the on-chain mandate is enforced |
