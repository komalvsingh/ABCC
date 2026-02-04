// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TFXToken
 * @dev ERC20 token for TrustForge lending platform
 */
contract TFXToken is ERC20, Ownable {
    
    constructor() ERC20("TrustForge Token", "TFX") Ownable(msg.sender) {
        // Mint initial supply (adjust as needed for testing)
        _mint(msg.sender, 1000000 * 10**decimals()); // 1 million tokens
    }
    
    /**
     * @dev Mint new tokens (for testing purposes)
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
