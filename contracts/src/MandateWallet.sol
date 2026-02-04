// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title MandateWallet
/// @notice On-chain USDC spending mandate: cap per period + optional allowlist. Only the designated agent can trigger transfers; contract enforces the mandate.
contract MandateWallet {
    address public owner;
    address public agent;
    address public token;

    uint256 public maxPerPeriod;
    uint256 public period;
    uint256 public periodStart;
    uint256 public usedThisPeriod;

    address[] public allowedRecipients;
    mapping(address => bool) public isAllowedRecipient;

    event MandateSet(uint256 maxPerPeriod, uint256 period, address[] allowedRecipients);
    event AgentSet(address indexed agent);
    event TransferExecuted(address indexed to, uint256 amount, uint256 usedThisPeriod);
    event Withdrawn(address indexed to, uint256 amount);

    error OnlyOwner();
    error OnlyAgent();
    error RecipientNotAllowed();
    error ExceedsMandate();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert OnlyAgent();
        _;
    }

    constructor(address _owner, address _token) {
        owner = _owner;
        token = _token;
        periodStart = block.timestamp;
    }

    /// @notice Set the address that can call executeTransfer (session key / delegate).
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentSet(_agent);
    }

    /// @notice Set mandate: max USDC per period, period length in seconds, optional allowlist. Pass empty array for "any recipient".
    function setMandate(
        uint256 _maxPerPeriod,
        uint256 _periodSeconds,
        address[] calldata _allowedRecipients
    ) external onlyOwner {
        maxPerPeriod = _maxPerPeriod;
        period = _periodSeconds;

        for (uint256 i = 0; i < allowedRecipients.length; i++) {
            isAllowedRecipient[allowedRecipients[i]] = false;
        }
        delete allowedRecipients;
        for (uint256 i = 0; i < _allowedRecipients.length; i++) {
            allowedRecipients.push(_allowedRecipients[i]);
            isAllowedRecipient[_allowedRecipients[i]] = true;
        }

        emit MandateSet(_maxPerPeriod, _periodSeconds, _allowedRecipients);
    }

    /// @notice Execute USDC transfer if mandate allows. Only callable by agent.
    function executeTransfer(address to, uint256 amount) external onlyAgent {
        if (allowedRecipients.length > 0 && !isAllowedRecipient[to]) revert RecipientNotAllowed();

        if (block.timestamp >= periodStart + period) {
            periodStart = block.timestamp;
            usedThisPeriod = 0;
        }
        if (usedThisPeriod + amount > maxPerPeriod) revert ExceedsMandate();

        usedThisPeriod += amount;

        bool ok = IERC20(token).transfer(to, amount);
        if (!ok) revert TransferFailed();

        emit TransferExecuted(to, amount, usedThisPeriod);
    }

    /// @notice Owner can withdraw any amount (emergency / drain).
    function withdraw(address to, uint256 amount) external onlyOwner {
        bool ok = IERC20(token).transfer(to, amount);
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    /// @notice Return list of allowed recipients (for frontends / skill).
    function getAllowedRecipients() external view returns (address[] memory) {
        return allowedRecipients;
    }
}
