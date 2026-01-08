"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// $KryptCash Staking Configuration
const CONFIG = {
  // Token mint address (set after pump.fun launch)
  STAKING_MINT: process.env.NEXT_PUBLIC_STAKING_MINT || null,
  
  // Streamflow staking pool (set after setup)
  STREAMFLOW_POOL: process.env.NEXT_PUBLIC_STREAMFLOW_POOL || null,
  
  // Minimum stake requirement (1M tokens)
  MIN_STAKE_AMOUNT: 1_000_000,
  
  // Lock period (0 = no lock)
  LOCK_PERIOD_SECONDS: 0,
  
  // Token decimals
  TOKEN_DECIMALS: 6,
};

export interface UserStakeInfo {
  stakedAmount: number;
  pendingRewards: number;  // SOL rewards
  lastStakeTime: number;
  stakeStartTime: number;
  totalRewardsClaimed: number;  // SOL claimed
  poolShare: number;  // Percentage of pool
}

export interface PoolInfo {
  totalStaked: number;
  rewardRate: string;
  rewardRatePerSecond: number;
  lockPeriod: string;
  tvl: number;
  stakerCount: number;
  rewardToken: string;
  feeSource: string;
  creatorFee: number;
  lpFee: number;
}

export function useStaking() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [isLoading, setIsLoading] = useState(false);
  const [userStake, setUserStake] = useState<UserStakeInfo | null>(null);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isConfigured, setIsConfigured] = useState(false);

  // Check if staking is configured
  useEffect(() => {
    const configured = Boolean(CONFIG.STAKING_MINT && CONFIG.STREAMFLOW_POOL);
    setIsConfigured(configured);
  }, []);

  // Fetch user's $KryptCash token balance
  const fetchTokenBalance = useCallback(async () => {
    if (!publicKey || !CONFIG.STAKING_MINT) {
      setTokenBalance(0);
      return;
    }

    try {
      const mintPubkey = new PublicKey(CONFIG.STAKING_MINT);
      
      // Try Token-2022 first (pump.fun tokens use this)
      try {
        const ata = await getAssociatedTokenAddress(
          mintPubkey, 
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );
        const account = await getAccount(connection, ata, undefined, TOKEN_2022_PROGRAM_ID);
        setTokenBalance(Number(account.amount) / Math.pow(10, CONFIG.TOKEN_DECIMALS));
        return;
      } catch {
        // Try regular SPL Token
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const account = await getAccount(connection, ata);
        setTokenBalance(Number(account.amount) / Math.pow(10, CONFIG.TOKEN_DECIMALS));
      }
    } catch {
      setTokenBalance(0);
    }
  }, [publicKey, connection]);

  // Fetch pool info - Real $KryptCash staking parameters
  const fetchPoolInfo = useCallback(async () => {
    // Real staking pool configuration
    setPoolInfo({
      totalStaked: 0,  // Will be populated from Streamflow
      rewardRate: "From trading fees",
      rewardRatePerSecond: 0,  // Dynamic based on volume
      lockPeriod: "None",  // 0 lock period
      tvl: 0,
      stakerCount: 0,
      rewardToken: "SOL",
      feeSource: "PumpSwap Trading Fees",
      creatorFee: 0.05,  // 0.05% creator fee
      lpFee: 0.20,  // 0.20% LP fee (if providing liquidity)
    });

    // TODO: Fetch real data from Streamflow when configured
    if (CONFIG.STREAMFLOW_POOL) {
      try {
        // Fetch from Streamflow API
        // const poolData = await streamflow.getPool(CONFIG.STREAMFLOW_POOL);
        // Update poolInfo with real data
      } catch (error) {
        console.error("Error fetching pool info:", error);
      }
    }
  }, []);

  // Fetch user stake info
  const fetchUserStake = useCallback(async () => {
    if (!publicKey) {
      setUserStake(null);
      return;
    }

    // Initialize with zero values
    setUserStake({
      stakedAmount: 0,
      pendingRewards: 0,
      lastStakeTime: 0,
      stakeStartTime: 0,
      totalRewardsClaimed: 0,
      poolShare: 0,
    });

    // TODO: Fetch real stake data from Streamflow when configured
    if (CONFIG.STREAMFLOW_POOL) {
      try {
        // const stakeData = await streamflow.getUserStake(CONFIG.STREAMFLOW_POOL, publicKey);
        // Update userStake with real data
      } catch (error) {
        console.error("Error fetching user stake:", error);
      }
    }
  }, [publicKey]);

  // Stake tokens
  const stake = useCallback(
    async (amount: number) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!isConfigured) {
        throw new Error("Staking not configured yet. Token launches soon on pump.fun!");
      }

      if (amount < CONFIG.MIN_STAKE_AMOUNT) {
        throw new Error(`Minimum stake is ${CONFIG.MIN_STAKE_AMOUNT.toLocaleString()} $KryptCash`);
      }

      setIsLoading(true);
      try {
        // TODO: Implement actual Streamflow staking transaction
        // const tx = await streamflow.stake(CONFIG.STREAMFLOW_POOL, amount);
        // await signTransaction(tx);
        
        throw new Error("Staking will be available after token launch on pump.fun");
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signTransaction, isConfigured]
  );

  // Unstake tokens
  const unstake = useCallback(
    async (amount: number) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!userStake || userStake.stakedAmount < amount) {
        throw new Error("Insufficient staked balance");
      }

      setIsLoading(true);
      try {
        // TODO: Implement actual Streamflow unstaking transaction
        // const tx = await streamflow.unstake(CONFIG.STREAMFLOW_POOL, amount);
        // await signTransaction(tx);
        
        throw new Error("Unstaking will be available after staking is live");
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signTransaction, userStake]
  );

  // Claim SOL rewards
  const claimRewards = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    if (!userStake || userStake.pendingRewards <= 0) {
      throw new Error("No SOL rewards to claim");
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual Streamflow claim transaction
      // const tx = await streamflow.claimRewards(CONFIG.STREAMFLOW_POOL);
      // await signTransaction(tx);
      
      throw new Error("Claiming will be available after staking is live");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, signTransaction, userStake]);

  // Initialize data on mount
  useEffect(() => {
    fetchPoolInfo();
  }, [fetchPoolInfo]);

  // Fetch user data when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchTokenBalance();
      fetchUserStake();
    } else {
      setTokenBalance(0);
      setUserStake(null);
    }
  }, [publicKey, fetchTokenBalance, fetchUserStake]);

  return {
    isLoading,
    userStake,
    poolInfo,
    tokenBalance,
    isConfigured,
    minStakeAmount: CONFIG.MIN_STAKE_AMOUNT,
    stake,
    unstake,
    claimRewards,
    refreshUserStake: fetchUserStake,
    refreshPoolInfo: fetchPoolInfo,
    refreshBalance: fetchTokenBalance,
  };
}
