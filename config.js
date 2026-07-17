/* ============================================================================
   骏马 JUNMA — dApp config. FILL IN the contract addresses after you deploy.
   Switch ACTIVE between "mainnet" and "testnet".
   ============================================================================ */
window.JUNMA_CONFIG = {
  ACTIVE: "mainnet", // "mainnet" | "testnet"

  networks: {
    mainnet: {
      chainId: 56,
      chainIdHex: "0x38",
      name: "BNB Smart Chain",
      rpc: "https://bsc-dataseed.bnbchain.org",
      explorer: "https://bscscan.com",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      // deployed & verified on BSC mainnet
      token: "0x2192f44d5200f3E6bA36019a5eDd412d1ce3283E",
      staking: "0x135Db0710D9dde48CDD6FdE2Dcb73745d8634786",
    },
    testnet: {
      chainId: 97,
      chainIdHex: "0x61",
      name: "BNB Smart Chain Testnet",
      rpc: "https://bsc-testnet-rpc.publicnode.com",
      explorer: "https://testnet.bscscan.com",
      nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
      // deployed on BSC testnet (chain 97)
      token: "0xeE6347d4DDfACfC69f829BfFDf5E68Ba88021ee0",
      staking: "0x39dC0E837CDA0Ca864EB24A3f268A538677f5058",
    },
  },

  // staking economics (mirrors the on-chain constants; display only)
  economics: {
    instantPct: 20, // instant rebate to wallet
    dailyPct: 2, // released per day
    durationDays: 50, // full cycle
    referralPct: 5, // direct-referral reward
    totalReturnPct: 120, // 20% instant + 100% over 50 days
  },

  // 留空 = 页脚不显示该入口;填上真实链接后自动出现,无需改代码
  socials: {
    twitter: "",
    telegram: "",
  },
};

// Minimal human-readable ABIs (only what the dApp calls).
window.JUNMA_ABIS = {
  token: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function treasuryBnb() view returns (uint256)",
    "function totalBurned() view returns (uint256)",
    "function totalBnbBoughtBack() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ],
  staking: [
    "function stake(uint256 amount, address upline)",
    "function bind(address upline)",
    "function claim(uint256 orderId) returns (uint256)",
    "function claimAll() returns (uint256)",
    "function stakingOpen() view returns (bool)",
    "function referrer(address) view returns (address)",
    "function directStaked(address) view returns (uint256)",
    "function referralEarned(address) view returns (uint256)",
    "function directCount(address) view returns (uint256)",
    "function directsOf(address) view returns (address[])",
    "function pendingOf(address) view returns (uint256)",
    "function getUserOrders(address) view returns (uint256[])",
    "function totalStaked() view returns (uint256)",
    "function totalInstantPaid() view returns (uint256)",
    "function totalDailyReleased() view returns (uint256)",
    "function totalReferralPaid() view returns (uint256)",
    "function poolBalance() view returns (uint256)",
    "function getUserOrderViews(address user) view returns (tuple(uint256 id, uint256 principal, uint256 startTime, uint256 claimed, uint256 claimable, uint256 totalToRelease, uint256 daysElapsed)[])",
  ],
};
