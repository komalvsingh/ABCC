// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TFXToken
 * @dev ERC20 token for TrustForge lending platform
 * Includes a controlled faucet for test usage
 */
contract TFXToken is ERC20, Ownable {

    // =========================
    // Faucet Configuration
    // =========================
    uint256 public constant FAUCET_AMOUNT = 100 * 10**18; // 100 TFX
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastClaimTime;

    constructor() ERC20("TrustForge Token", "TFX") Ownable(msg.sender) {
        // Initial supply minted to owner
        _mint(msg.sender, 1_000_000 * 10**decimals()); // 1 million TFX
    }

    /**
     * @dev Faucet function
     * Users can claim limited TFX for lending/borrowing
     */
    function claimTFX() external {
        require(
            block.timestamp - lastClaimTime[msg.sender] >= FAUCET_COOLDOWN,
            "Faucet cooldown active"
        );

        require(
            balanceOf(owner()) >= FAUCET_AMOUNT,
            "Owner has insufficient TFX"
        );

        lastClaimTime[msg.sender] = block.timestamp;

        // Transfer from owner to user
        _transfer(owner(), msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @dev Owner can mint extra tokens if needed (testing only)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
