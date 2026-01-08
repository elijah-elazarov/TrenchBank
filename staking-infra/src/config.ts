import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

// ============ $KryptCash TOKEN INFO ============
export const TOKEN_INFO = {
  NAME: "KryptCash",
  TICKER: "$KryptCash",
  DECIMALS: 6,
};

// ============ STAKING CONFIGURATION ============
export const STAKING_CONFIG = {
  // Minimum tokens required to stake (1M tokens with 6 decimals)
  MIN_STAKE_AMOUNT: BigInt(process.env.MIN_STAKE_AMOUNT || "1000000000000"),
  
  // Lock period in seconds (0 = no lock, claim anytime)
  LOCK_PERIOD_SECONDS: Number(process.env.LOCK_PERIOD_SECONDS || "0"),
  
  // Fee router interval (default: 1 hour)
  ROUTER_INTERVAL_MS: Number(process.env.ROUTER_INTERVAL_MS || "3600000"),
  
  // Minimum fees to trigger distribution (0.01 SOL)
  MIN_FEE_THRESHOLD_SOL: Number(process.env.MIN_FEE_THRESHOLD_SOL || "0.01"),
};

// ============ PUMPSWAP FEE STRUCTURE ============
export const PUMPSWAP_FEES = {
  // Total trading fee
  TOTAL_FEE_BPS: 30, // 0.30%
  
  // Fee breakdown
  LP_FEE_BPS: 20,      // 0.20% to LPs
  CREATOR_FEE_BPS: 5,  // 0.05% to token creator (YOU!)
  PROTOCOL_FEE_BPS: 5, // 0.05% to pump.fun protocol
};

// ============ TOKEN ADDRESSES ============
export const TOKENS = {
  // $KryptCash token mint (fill in after launch on pump.fun)
  KRYPTCASH_MINT: process.env.TOKEN_MINT 
    ? new PublicKey(process.env.TOKEN_MINT) 
    : null,
  
  // Wrapped SOL for rewards
  WSOL_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
  
  // Native SOL mint (for reference)
  SOL_MINT: new PublicKey("So11111111111111111111111111111111111111112"),
};

// ============ PROGRAM IDs ============
export const PROGRAMS = {
  // PumpSwap AMM Program
  PUMPSWAP_AMM: new PublicKey("PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP"),
  
  // Streamflow Staking (mainnet)
  STREAMFLOW_STAKING: new PublicKey("STAKEvGqQTtzJZH6BWDcbpzXXn2BBerPAgQ3EGLN2GH"),
  
  // Token-2022 Program (pump.fun tokens use this)
  TOKEN_2022: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
  
  // Token Program
  TOKEN_PROGRAM: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
};

// ============ POOL ADDRESSES ============
export const POOLS = {
  // PumpSwap pool (auto-created after graduation, fill in address)
  PUMPSWAP_POOL: process.env.PUMPSWAP_POOL_ADDRESS 
    ? new PublicKey(process.env.PUMPSWAP_POOL_ADDRESS) 
    : null,
  
  // Streamflow staking pool (fill in after creation)
  STREAMFLOW_POOL: process.env.STREAMFLOW_STAKING_POOL 
    ? new PublicKey(process.env.STREAMFLOW_STAKING_POOL) 
    : null,
};

// ============ CONNECTION ============
export function getConnection(): Connection {
  const rpcUrl = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(rpcUrl, "confirmed");
}

// ============ WALLET ============
export function loadWallet(): Keypair {
  // Check for private key in env first
  if (process.env.WALLET_PRIVATE_KEY) {
    const bs58 = require("bs58");
    return Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY));
  }
  
  // Fallback to file path
  const walletPath = process.env.WALLET_PATH || 
    path.join(process.env.HOME || "", ".config/solana/id.json");
  
  const resolvedPath = walletPath.replace("~", process.env.HOME || "");
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Wallet not found at ${resolvedPath}`);
  }
  
  const walletData = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(walletData));
}

// ============ HELPERS ============
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / 1e9;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1e9));
}

export function formatTokenAmount(amount: bigint, decimals: number = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  return `${whole}.${fraction.toString().padStart(decimals, "0")}`;
}

export function tokensToRaw(amount: number, decimals: number = 6): bigint {
  return BigInt(Math.floor(amount * (10 ** decimals)));
}

// ============ INITIALIZATION LOG ============
console.log("╔════════════════════════════════════════════╗");
console.log("║    $KryptCash STAKING INFRASTRUCTURE       ║");
console.log("╠════════════════════════════════════════════╣");
console.log(`║ RPC: ${(process.env.RPC_URL || "mainnet-beta").slice(0, 35).padEnd(35)} ║`);
console.log(`║ Min Stake: ${formatTokenAmount(STAKING_CONFIG.MIN_STAKE_AMOUNT).slice(0, 28).padEnd(28)} ║`);
console.log(`║ Lock Period: ${STAKING_CONFIG.LOCK_PERIOD_SECONDS} seconds`.padEnd(43) + " ║");
console.log("╚════════════════════════════════════════════╝");
