'use strict';

// ===== NETWORK CONFIGURATION =====
const NETWORK_CONFIG = {
    BASE: { name: "Base Mainnet", chainId: 8453, explorer: "https://basescan.org", rpc: "https://mainnet.base.org" },
    ARBITRUM: { name: "Arbitrum Mainnet", chainId: 42161, explorer: "https://arbiscan.io", rpc: "https://arb1.arbitrum.io/rpc" },
    OPTIMISM: { name: "Optimism Mainnet", chainId: 10, explorer: "https://optimistic.etherscan.io", rpc: "https://mainnet.optimism.io" },
    POLYGON: { name: "Polygon Mainnet", chainId: 137, explorer: "https://polygonscan.com", rpc: "https://polygon-rpc.com" },
    ETHEREUM: { name: "Ethereum Mainnet", chainId: 1, explorer: "https://etherscan.io", rpc: "https://eth.llamarpc.com" }
};

// ===== TOKEN ABI =====
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

// ===== UTILITY FUNCTIONS =====
// ===== GAS CONFIGURATION =====
const GAS_CONFIG = {
    GAS_LIMIT: 100000,
    MIN_ETH_BALANCE: 0.0001,
    CHECK_INTERVAL_MS: 10000,
    GAS_ESTIMATE_BUFFER: 1.2,
    TOKEN_SCAN_INTERVAL: 30000
};

module.exports = { NETWORK_CONFIG, ERC20_ABI, GAS_CONFIG };
