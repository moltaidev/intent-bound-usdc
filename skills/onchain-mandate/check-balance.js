#!/usr/bin/env node
/**
 * Check USDC balance of MandateWallet (or any address).
 * Usage: node check-balance.js <address> [rpcUrl]
 */

async function main() {
  const address = process.argv[2];
  const rpcUrl = process.argv[3] || "https://sepolia.base.org";
  if (!address) {
    console.error("Usage: node check-balance.js <address> [rpcUrl]");
    process.exit(1);
  }

  let createPublicClient, http, parseAbi;
  try {
    const viem = require("viem");
    createPublicClient = viem.createPublicClient;
    http = viem.http;
    parseAbi = viem.parseAbi;
  } catch (e) {
    console.error("Install viem: npm install viem");
    process.exit(1);
  }

  const chain = { id: 84532, name: "Base Sepolia", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

  const raw = await publicClient.readContract({
    address: usdcAddress,
    abi,
    functionName: "balanceOf",
    args: [address],
  });
  const usdc = Number(raw) / 1e6;
  console.log(address);
  console.log("USDC balance:", usdc);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
