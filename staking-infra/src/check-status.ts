/**
 * $KryptCash Staking Infrastructure Status Check
 * 
 * Shows comprehensive status of:
 * - PumpSwap pool (trading, fees, LP)
 * - Creator earnings
 * - Streamflow staking pool
 * - Staker statistics
 * 
 * Usage:
 *   npm run check:status
 */

import { 
  Connection, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  getConnection, 
  loadWallet, 
  POOLS, 
  TOKENS,
  STAKING_CONFIG,
  PUMPSWAP_FEES,
  lamportsToSol,
  formatTokenAmount,
  TOKEN_INFO
} from "./config.js";

async function main() {
  const connection = getConnection();
  const wallet = loadWallet();
  
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║               $KryptCash STAKING INFRASTRUCTURE              ║");
  console.log("║                       STATUS DASHBOARD                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  
  // ============ WALLET STATUS ============
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 👛 WALLET                                                    │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│ Address: ${wallet.publicKey.toBase58().slice(0, 44)}...│`);
  console.log(`│ SOL Balance: ${lamportsToSol(balance).toFixed(4).padEnd(47)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ TOKEN STATUS ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🪙 $KryptCash TOKEN                                          │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  if (TOKENS.KRYPTCASH_MINT) {
    console.log(`│ Mint: ${TOKENS.KRYPTCASH_MINT.toBase58().slice(0, 44)}...      │`);
    console.log(`│ Status: ✅ Configured                                       │`);
  } else {
    console.log(`│ Mint: Not configured                                        │`);
    console.log(`│ Status: ⏳ Awaiting pump.fun launch                         │`);
  }
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ PUMPSWAP STATUS ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🔄 PUMPSWAP POOL                                             │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  if (POOLS.PUMPSWAP_POOL) {
    console.log(`│ Pool: ${POOLS.PUMPSWAP_POOL.toBase58().slice(0, 44)}...      │`);
    console.log(`│ Status: ✅ Active                                           │`);
    console.log("│                                                             │");
    console.log("│ Fee Structure:                                              │");
    console.log(`│   Total Fee:    ${(PUMPSWAP_FEES.TOTAL_FEE_BPS / 100).toFixed(2)}%                                       │`);
    console.log(`│   → LP Reward:  ${(PUMPSWAP_FEES.LP_FEE_BPS / 100).toFixed(2)}% (if you provide liquidity)          │`);
    console.log(`│   → Creator:    ${(PUMPSWAP_FEES.CREATOR_FEE_BPS / 100).toFixed(2)}% (automatic!)                      │`);
    console.log(`│   → Protocol:   ${(PUMPSWAP_FEES.PROTOCOL_FEE_BPS / 100).toFixed(2)}% (to pump.fun)                     │`);
  } else {
    console.log(`│ Pool: Not configured                                        │`);
    console.log(`│ Status: ⏳ Awaiting graduation from pump.fun                │`);
    console.log("│                                                             │");
    console.log("│ Next Steps:                                                 │");
    console.log("│   1. Launch token on pump.fun                               │");
    console.log("│   2. Wait for graduation (~$69k market cap)                 │");
    console.log("│   3. Get pool address from pump.fun                         │");
    console.log("│   4. Set PUMPSWAP_POOL_ADDRESS in .env                      │");
  }
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ STREAMFLOW STATUS ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🏦 STREAMFLOW STAKING                                        │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  if (POOLS.STREAMFLOW_POOL) {
    console.log(`│ Pool: ${POOLS.STREAMFLOW_POOL.toBase58().slice(0, 44)}...      │`);
    console.log(`│ Status: ✅ Active                                           │`);
    console.log("│                                                             │");
    console.log("│ Configuration:                                              │");
    console.log(`│   Min Stake: ${formatTokenAmount(STAKING_CONFIG.MIN_STAKE_AMOUNT).slice(0, 20)} $KryptCash          │`);
    console.log(`│   Lock Period: ${STAKING_CONFIG.LOCK_PERIOD_SECONDS === 0 ? "None (claim anytime)" : STAKING_CONFIG.LOCK_PERIOD_SECONDS + " seconds"}              │`);
    console.log(`│   Reward: Native SOL                                        │`);
  } else {
    console.log(`│ Pool: Not configured                                        │`);
    console.log(`│ Status: ⏳ Run 'npm run setup:staking' to create            │`);
  }
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ FEE ROUTER STATUS ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🔀 FEE ROUTER                                                │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log(`│ Interval: ${(STAKING_CONFIG.ROUTER_INTERVAL_MS / 1000 / 60).toFixed(0)} minutes                                          │`);
  console.log(`│ Threshold: ${STAKING_CONFIG.MIN_FEE_THRESHOLD_SOL} SOL minimum to route                       │`);
  console.log("│                                                             │");
  console.log("│ Flow:                                                       │");
  console.log("│   PumpSwap Fees → Claim → Deposit to Streamflow → Stakers   │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ EARNINGS ESTIMATE ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 📈 EARNINGS ESTIMATE (Your Revenue as Creator + LP)          │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│                                                             │");
  console.log("│   Daily Volume      Creator (0.05%)    LP (0.20%)*          │");
  console.log("│   ─────────────     ──────────────     ──────────           │");
  console.log("│   $10,000           $5/day             $20/day              │");
  console.log("│   $50,000           $25/day            $100/day             │");
  console.log("│   $100,000          $50/day            $200/day             │");
  console.log("│   $500,000          $250/day           $1,000/day           │");
  console.log("│   $1,000,000        $500/day           $2,000/day           │");
  console.log("│                                                             │");
  console.log("│   * LP earnings require adding liquidity to the pool        │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  // ============ COMMANDS ============
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ 🛠️  AVAILABLE COMMANDS                                       │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│                                                             │");
  console.log("│   npm run lp:add         Add liquidity to PumpSwap          │");
  console.log("│   npm run lp:remove      Remove liquidity                   │");
  console.log("│   npm run lp:status      Check LP position                  │");
  console.log("│   npm run claim:creator  Claim creator fees                 │");
  console.log("│   npm run setup:staking  Create Streamflow staking pool     │");
  console.log("│   npm run router:start   Route fees to staking (once)       │");
  console.log("│   npm run router:dev     Route fees continuously            │");
  console.log("│   npm run check:status   Show this dashboard                │");
  console.log("│                                                             │");
  console.log("└─────────────────────────────────────────────────────────────┘");
  
  console.log("\n✅ Status check complete!\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
