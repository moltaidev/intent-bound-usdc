// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MandateWallet} from "../src/MandateWallet.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract MockERC20 is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function name() external pure returns (string memory) { return "Mock USDC"; }
    function symbol() external pure returns (string memory) { return "USDC"; }
    function decimals() external pure returns (uint8) { return 6; }
}

contract MandateWalletTest is Test {
    MandateWallet public wallet;
    MockERC20 public token;

    address owner = address(1);
    address agent = address(2);
    address alice = address(3);
    address bob = address(4);

    function setUp() public {
        token = new MockERC20();
        token.mint(address(this), 1000e6);
        wallet = new MandateWallet(owner, address(token));
        vm.prank(owner);
        wallet.setAgent(agent);
        token.transfer(address(wallet), 500e6);
    }

    function test_SetMandateAndExecute() public {
        vm.startPrank(owner);
        address[] memory allowlist;
        wallet.setMandate(50e6, 1 weeks, allowlist);
        vm.stopPrank();

        vm.prank(agent);
        wallet.executeTransfer(alice, 30e6);
        assertEq(token.balanceOf(alice), 30e6);
        assertEq(wallet.usedThisPeriod(), 30e6);

        vm.prank(agent);
        wallet.executeTransfer(bob, 20e6);
        assertEq(token.balanceOf(bob), 20e6);
        assertEq(wallet.usedThisPeriod(), 50e6);

        vm.prank(agent);
        vm.expectRevert(MandateWallet.ExceedsMandate.selector);
        wallet.executeTransfer(alice, 1);
    }

    function test_AllowlistEnforced() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = alice;

        vm.startPrank(owner);
        wallet.setMandate(100e6, 1 weeks, allowlist);
        vm.stopPrank();

        vm.prank(agent);
        wallet.executeTransfer(alice, 10e6);
        assertEq(token.balanceOf(alice), 10e6);

        vm.prank(agent);
        vm.expectRevert(MandateWallet.RecipientNotAllowed.selector);
        wallet.executeTransfer(bob, 10e6);
    }

    function test_OnlyAgentCanExecute() public {
        vm.startPrank(owner);
        address[] memory allowlist;
        wallet.setMandate(50e6, 1 weeks, allowlist);
        vm.stopPrank();

        vm.prank(owner);
        vm.expectRevert(MandateWallet.OnlyAgent.selector);
        wallet.executeTransfer(alice, 10e6);
    }
}
