// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/Console.sol";
import {MandateWallet} from "../src/MandateWallet.sol";

/// @notice Deploy MandateWallet on Base Sepolia. Set OWNER and AGENT via env; USDC = Circle testnet.
contract DeployMandateWallet is Script {
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address owner = vm.envOr("MANDATE_OWNER", msg.sender);
        address agent = vm.envOr("MANDATE_AGENT", msg.sender);

        vm.startBroadcast();
        MandateWallet wallet = new MandateWallet(owner, USDC_BASE_SEPOLIA);
        wallet.setAgent(agent);
        vm.stopBroadcast();

        console.log("MandateWallet deployed at:", address(wallet));
        console.log("Owner:", owner);
        console.log("Agent:", agent);
        console.log("Token (USDC):", USDC_BASE_SEPOLIA);
    }
}
