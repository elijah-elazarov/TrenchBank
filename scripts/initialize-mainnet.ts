import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
  clusterApiUrl 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount
} from "@solana/spl-token";
import { MemecoinStaking } from "../target/types/memecoin_staking";
import * as fs from "fs";

// ============ CONFIGURATION ============
const STAKING_MINT = new PublicKey("3v2DnzpGTAEYVqcStcHvaPBtAEfY5gxZdvWDcNxkpump");
const REWARD_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC Mainnet

// Reward rate: 0.10 USDC per 1M tokens per 5 minutes
// Calculation: 0.10 USDC = 100,000 base units (6 decimals)
// 1M tokens = 1e12 base units (6 decimals)
// 5 min = 300 seconds
// rate = 100,000 * 1e18 / (1e12 * 300) = 333,333,333
const REWARD_RATE = new anchor.BN(333_333_333);

// Lock period: 5 minutes = 300 seconds
const LOCK_PERIOD = new anchor.BN(300);

// Minimum stake: 1,000,000 tokens (with 6 decimals = 1e12 base units)
const MIN_STAKE_AMOUNT = new anchor.BN(1_000_000_000_000);

// Initial USDC funding: 30 USDC (with 6 decimals = 30,000,000 base units)
const INITIAL_FUNDING = new anchor.BN(30_000_000);

async function main() {
  // Load wallet from default Solana config
  const walletPath = process.env.ANCHOR_WALLET || 
    `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  console.log("=".repeat(60));
  console.log("MEMECOIN STAKING POOL - MAINNET INITIALIZATION");
  console.log("=".repeat(60));
  console.log("\nWallet:", walletKeypair.publicKey.toString());
  
  // Setup connection to mainnet
  const connection = new Connection(
    process.env.RPC_URL || clusterApiUrl("mainnet-beta"),
    "confirmed"
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.MemecoinStaking as Program<MemecoinStaking>;
  
  console.log("Program ID:", program.programId.toString());
  console.log("\n--- Pool Configuration ---");
  console.log("Staking Token:", STAKING_MINT.toString());
  console.log("Reward Token (USDC):", REWARD_MINT.toString());
  console.log("Reward Rate:", REWARD_RATE.toString(), "(0.10 USDC per 1M tokens per 5 min)");
  console.log("Lock Period:", LOCK_PERIOD.toString(), "seconds (5 minutes)");
  console.log("Min Stake:", MIN_STAKE_AMOUNT.toString(), "base units (1M tokens)");
  console.log("Initial Funding:", INITIAL_FUNDING.toString(), "base units (30 USDC)");

  // Derive PDAs
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), STAKING_MINT.toBuffer()],
    program.programId
  );
  
  const [poolVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), poolPda.toBuffer()],
    program.programId
  );
  
  const [rewardVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("reward_vault"), poolPda.toBuffer()],
    program.programId
  );

  console.log("\n--- Derived Addresses ---");
  console.log("Pool PDA:", poolPda.toString());
  console.log("Pool Vault PDA:", poolVaultPda.toString());
  console.log("Reward Vault PDA:", rewardVaultPda.toString());

  // Check wallet balances
  const solBalance = await connection.getBalance(walletKeypair.publicKey);
  console.log("\n--- Wallet Balances ---");
  console.log("SOL Balance:", solBalance / 1e9, "SOL");
  
  const walletUsdcAta = await getAssociatedTokenAddress(
    REWARD_MINT,
    walletKeypair.publicKey
  );
  
  try {
    const usdcAccount = await getAccount(connection, walletUsdcAta);
    console.log("USDC Balance:", Number(usdcAccount.amount) / 1e6, "USDC");
    
    if (Number(usdcAccount.amount) < Number(INITIAL_FUNDING)) {
      console.error("\n❌ ERROR: Insufficient USDC balance for initial funding!");
      console.error(`   Need: ${Number(INITIAL_FUNDING) / 1e6} USDC`);
      console.error(`   Have: ${Number(usdcAccount.amount) / 1e6} USDC`);
      process.exit(1);
    }
  } catch (e) {
    console.error("\n❌ ERROR: No USDC token account found for wallet!");
    console.error("   Please ensure you have USDC in your wallet.");
    process.exit(1);
  }

  if (solBalance < 0.01 * 1e9) {
    console.error("\n❌ ERROR: Insufficient SOL for transactions!");
    console.error("   Need at least 0.01 SOL for transaction fees.");
    console.error(`   Have: ${solBalance / 1e9} SOL`);
    process.exit(1);
  }

  // Confirm before proceeding
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  WARNING: This will deploy to MAINNET!");
  console.log("⚠️  This action uses real SOL and USDC!");
  console.log("=".repeat(60));
  console.log("\nPress Ctrl+C within 10 seconds to cancel...");
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log("\n🚀 Initializing pool...");

  try {
    const tx = await program.methods
      .initializePool(REWARD_RATE, LOCK_PERIOD, MIN_STAKE_AMOUNT)
      .accountsPartial({
        authority: walletKeypair.publicKey,
        stakingMint: STAKING_MINT,
        rewardMint: REWARD_MINT,
        stakingTokenProgram: TOKEN_2022_PROGRAM_ID, // pump.fun uses Token-2022
        tokenProgram: TOKEN_PROGRAM_ID, // USDC uses regular Token program
      })
      .rpc();

    console.log("✅ Pool initialized!");
    console.log("   Transaction:", tx);
    console.log("   View on Solscan: https://solscan.io/tx/" + tx);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("ℹ️  Pool already initialized, skipping...");
    } else {
      throw e;
    }
  }

  // Fund the reward vault
  console.log("\n💰 Funding reward vault with 30 USDC...");
  
  try {
    const fundTx = await program.methods
      .fundRewards(INITIAL_FUNDING)
      .accountsPartial({
        funder: walletKeypair.publicKey,
        pool: poolPda,
        funderTokenAccount: walletUsdcAta,
      })
      .rpc();

    console.log("✅ Reward vault funded!");
    console.log("   Transaction:", fundTx);
    console.log("   View on Solscan: https://solscan.io/tx/" + fundTx);
  } catch (e: any) {
    console.error("❌ Failed to fund reward vault:", e.message);
    throw e;
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 SETUP COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nPool Address:", poolPda.toString());
  console.log("Pool Vault:", poolVaultPda.toString());
  console.log("Reward Vault:", rewardVaultPda.toString());
  console.log("\nUsers can now stake their tokens!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Error:", err);
    process.exit(1);
  });

