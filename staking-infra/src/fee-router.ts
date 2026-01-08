/**
 * Fee Router for $KryptCash Staking Rewards
 * 
 * This bot automatically:
 * 1. Claims creator fees from PumpSwap (0.05% of all trades)
 * 2. Optionally claims LP fees (0.20% of trades you provide liquidity for)
 * 3. Routes all SOL to Streamflow staking pool for distribution
 * 
 * Stakers then earn proportional SOL rewards!
 * 
 * Usage:
 *   npm run router:start   - Run once
 *   npm run router:dev     - Run with auto-reload (development)
 */

import { 
  Connection, 
  Keypair, 
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { 
  getConnection, 
  loadWallet, 
  POOLS, 
  STAKING_CONFIG,
  lamportsToSol,
  solToLamports,
  TOKEN_INFO
} from "./config.js";

// ============ TYPES ============
interface FeeCollection {
  creatorFees: number;  // SOL
  lpFees: number;       // SOL
  totalCollected: number;
}

interface RouterStats {
  totalRouted: number;
  lastRunTime: Date | null;
  successfulRuns: number;
  failedRuns: number;
}

// ============ FEE COLLECTION ============
async function collectCreatorFees(
  connection: Connection,
  wallet: Keypair,
  poolAddress: PublicKey
): Promise<number> {
  try {
    console.log("\n💎 Collecting creator fees...");
    
    // TODO: Replace with actual PumpSwap SDK call
    /*
    const sdk = new PumpSwapSDK(connection, wallet);
    
    const pendingRewards = await sdk.getCreatorRewards(poolAddress);
    
    if (pendingRewards.pending <= 0) {
      console.log("   No pending creator fees");
      return 0;
    }
    
    const tx = await sdk.claimCreatorRewards(poolAddress);
    const amount = lamportsToSol(pendingRewards.pending);
    
    console.log(`   ✅ Claimed ${amount.toFixed(6)} SOL`);
    console.log(`   TX: ${tx}`);
    
    return amount;
    */
    
    console.log("   ⚠️ SDK integration pending");
    return 0;
  } catch (error) {
    console.error("   ❌ Error collecting creator fees:", error);
    return 0;
  }
}

async function collectLPFees(
  connection: Connection,
  wallet: Keypair,
  poolAddress: PublicKey
): Promise<number> {
  try {
    console.log("\n💧 Collecting LP fees...");
    
    // TODO: Replace with actual PumpSwap SDK call
    /*
    const sdk = new PumpSwapSDK(connection, wallet);
    
    const position = await sdk.getLPPosition(poolAddress);
    
    if (!position || position.unclaimedFees.quote <= 0) {
      console.log("   No pending LP fees");
      return 0;
    }
    
    const tx = await sdk.claimLPFees(poolAddress);
    const amount = lamportsToSol(position.unclaimedFees.quote);
    
    console.log(`   ✅ Claimed ${amount.toFixed(6)} SOL`);
    console.log(`   TX: ${tx}`);
    
    return amount;
    */
    
    console.log("   ⚠️ SDK integration pending");
    return 0;
  } catch (error) {
    console.error("   ❌ Error collecting LP fees:", error);
    return 0;
  }
}

// ============ STREAMFLOW DEPOSIT ============
async function depositToStreamflow(
  connection: Connection,
  wallet: Keypair,
  amount: number
): Promise<string | null> {
  try {
    console.log(`\n📤 Depositing ${amount.toFixed(6)} SOL to Streamflow staking...`);
    
    if (!POOLS.STREAMFLOW_POOL) {
      console.log("   ⚠️ Streamflow pool not configured");
      console.log("   Run 'npm run setup:staking' first");
      return null;
    }
    
    // TODO: Replace with actual Streamflow SDK call
    /*
    import { StreamflowStaking } from "@streamflow/staking";
    
    const staking = new StreamflowStaking({
      cluster: "mainnet-beta",
    });
    
    const tx = await staking.depositRewards({
      stakePoolId: POOLS.STREAMFLOW_POOL.toBase58(),
      amount: solToLamports(amount),
      sender: wallet,
    });
    
    console.log(`   ✅ Deposited to staking pool!`);
    console.log(`   TX: ${tx}`);
    
    return tx;
    */
    
    console.log("   ⚠️ Streamflow SDK integration pending");
    console.log(`   Would deposit ${amount.toFixed(6)} SOL for staker rewards`);
    
    return null;
  } catch (error) {
    console.error("   ❌ Error depositing to Streamflow:", error);
    return null;
  }
}

// ============ ROUTER LOGIC ============
async function runFeeRouter(): Promise<FeeCollection> {
  const connection = getConnection();
  const wallet = loadWallet();
  
  console.log("\n" + "═".repeat(50));
  console.log("      $KryptCash FEE ROUTER - COLLECTING FEES");
  console.log("═".repeat(50));
  console.log(`\nTime: ${new Date().toLocaleString()}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Check wallet balance before
  const balanceBefore = await connection.getBalance(wallet.publicKey);
  console.log(`\n💰 Starting balance: ${lamportsToSol(balanceBefore).toFixed(4)} SOL`);
  
  const collection: FeeCollection = {
    creatorFees: 0,
    lpFees: 0,
    totalCollected: 0,
  };
  
  if (!POOLS.PUMPSWAP_POOL) {
    console.log("\n⚠️ PumpSwap pool not configured!");
    console.log("   Set PUMPSWAP_POOL_ADDRESS in .env");
    return collection;
  }
  
  // Collect creator fees
  collection.creatorFees = await collectCreatorFees(
    connection, 
    wallet, 
    POOLS.PUMPSWAP_POOL
  );
  
  // Collect LP fees (if you've added liquidity)
  collection.lpFees = await collectLPFees(
    connection, 
    wallet, 
    POOLS.PUMPSWAP_POOL
  );
  
  collection.totalCollected = collection.creatorFees + collection.lpFees;
  
  // Check wallet balance after collection
  const balanceAfter = await connection.getBalance(wallet.publicKey);
  const actualGain = lamportsToSol(balanceAfter - balanceBefore);
  
  console.log("\n" + "─".repeat(50));
  console.log("📊 COLLECTION SUMMARY");
  console.log("─".repeat(50));
  console.log(`   Creator Fees:  ${collection.creatorFees.toFixed(6)} SOL`);
  console.log(`   LP Fees:       ${collection.lpFees.toFixed(6)} SOL`);
  console.log(`   Total:         ${collection.totalCollected.toFixed(6)} SOL`);
  console.log(`   Actual Gain:   ${actualGain.toFixed(6)} SOL`);
  
  // Route to Streamflow if above threshold
  const threshold = STAKING_CONFIG.MIN_FEE_THRESHOLD_SOL;
  const availableToRoute = lamportsToSol(balanceAfter) - 0.1; // Keep 0.1 SOL for fees
  
  if (availableToRoute >= threshold) {
    console.log(`\n✅ Above threshold (${threshold} SOL) - routing to staking`);
    await depositToStreamflow(connection, wallet, availableToRoute);
  } else {
    console.log(`\n⏳ Below threshold (${availableToRoute.toFixed(6)} < ${threshold} SOL)`);
    console.log("   Will route when more fees accumulate");
  }
  
  console.log("\n" + "═".repeat(50));
  
  return collection;
}

// ============ CONTINUOUS MODE ============
async function runContinuous(): Promise<void> {
  const interval = STAKING_CONFIG.ROUTER_INTERVAL_MS;
  
  console.log("\n🔄 Starting Fee Router in continuous mode");
  console.log(`   Interval: ${interval / 1000 / 60} minutes`);
  console.log(`   Press Ctrl+C to stop\n`);
  
  // Run immediately
  await runFeeRouter();
  
  // Then run on interval
  setInterval(async () => {
    try {
      await runFeeRouter();
    } catch (error) {
      console.error("Router error:", error);
    }
  }, interval);
}

// ============ MAIN ============
async function main() {
  const mode = process.argv[2] || "once";
  
  console.log("\n🚀 $KryptCash Fee Router");
  console.log("─".repeat(40));
  console.log("Routes PumpSwap fees → Streamflow staking → Staker rewards");
  
  if (mode === "continuous" || mode === "loop") {
    await runContinuous();
  } else {
    await runFeeRouter();
    console.log("\n✅ Single run complete. Use 'continuous' mode for ongoing routing.");
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
