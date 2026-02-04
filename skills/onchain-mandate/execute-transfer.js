#!/usr/bin/env node
/**
 * Execute a USDC transfer via MandateWallet.executeTransfer(to, amount).
 * Usage: node execute-transfer.js <walletAddress> <to> <amountUsdc> [rpcUrl]
 * Requires: MANDATE_AGENT_PRIVATE_KEY in env (or pass config path via ONCHAIN_MANDATE_CONFIG).
 * Amount in human USDC (e.g. 10 = 10 USDC). Contract uses 6 decimals.
 */

const fs = require("fs");
const path = require("path");

if (fs.existsSync(path.join(__dirname, ".env"))) {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
}

async function main() {
  const walletAddress = process.argv[2];
  const to = process.argv[3];
  const amountUsdc = process.argv[4];
  const rpcUrl = process.argv[5] || "https://sepolia.base.org";

  if (!walletAddress || !to || !amountUsdc) {
    console.error("Usage: node execute-transfer.js <walletAddress> <to> <amountUsdc> [rpcUrl]");
    process.exit(1);
  }

  const key = process.env.MANDATE_AGENT_PRIVATE_KEY;
  if (!key) {
    console.error("Set MANDATE_AGENT_PRIVATE_KEY in env.");
    process.exit(1);
  }

  let createWalletClient, createPublicClient, http, parseAbi, privateKeyToAccount;
  try {
    const viem = require("viem");
    const accounts = require("viem/accounts");
    createWalletClient = viem.createWalletClient;
    createPublicClient = viem.createPublicClient;
    http = viem.http;
    parseAbi = viem.parseAbi;
    privateKeyToAccount = accounts.privateKeyToAccount;
  } catch (e) {
    console.error("Install viem: npm install viem");
    process.exit(1);
  }

  const chain = { id: 84532, name: "Base Sepolia", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [rpcUrl] } } };
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`));
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const amountRaw = BigInt(Math.floor(parseFloat(amountUsdc) * 1e6));
  const abi = parseAbi(["function executeTransfer(address to, uint256 amount)"]);

  const hash = await walletClient.writeContract({
    address: walletAddress,
    abi,
    functionName: "executeTransfer",
    args: [to, amountRaw],
  });

  console.log("Tx hash:", hash);
  console.log("Explorer: https://sepolia.basescan.org/tx/" + hash);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
