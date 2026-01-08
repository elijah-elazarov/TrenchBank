"use client";

import { useState } from "react";
import { useStaking } from "@/hooks/useStaking";
import { toast } from "react-hot-toast";

const TOKEN_TICKER = "KryptCash";

export function RewardsPanel() {
  const { userStake, claimRewards, isLoading, isConfigured, refreshUserStake } = useStaking();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUserStake();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleClaim = async () => {
    try {
      await claimRewards();
      toast.success("SOL rewards claimed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to claim rewards");
    }
  };

  const pendingRewards = userStake?.pendingRewards || 0;
  const hasRewards = pendingRewards > 0.000001;

  return (
    <div className="gradient-border p-6 glow-accent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>💰</span>
          SOL Rewards
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-md hover:bg-trench-card transition-colors group"
          title="Refresh rewards"
        >
          <svg
            className={`w-4 h-4 text-gray-400 group-hover:text-trench-accent transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {!isConfigured ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center opacity-50">
            <span className="text-2xl">◎</span>
          </div>
          <p className="text-sm text-gray-400 mb-2">Rewards Available After Launch</p>
          <p className="text-xs text-gray-500">
            Stake $KryptCash to earn real SOL from trading fees
          </p>
        </div>
      ) : (
        <>
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">Claimable Rewards</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <span className="text-sm font-bold">◎</span>
              </div>
              <p className="text-4xl font-bold font-mono gradient-text">
                {pendingRewards.toFixed(6)}
              </p>
            </div>
            <p className="text-sm text-gray-400 mt-1">SOL</p>
          </div>

          {/* Reward source info */}
          <div className="space-y-2 mb-6 p-3 rounded-lg bg-trench-darker/50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reward Source</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">From Creator Fees</span>
              <span className="text-trench-accent font-mono">0.05%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">From LP Fees</span>
              <span className="text-trench-cyan font-mono">0.20%</span>
            </div>
            <div className="border-t border-trench-border mt-2 pt-2 flex justify-between text-sm">
              <span className="text-gray-300">Total Fee Share</span>
              <span className="text-white font-mono font-semibold">0.25%</span>
            </div>
          </div>

          {/* Claim Button */}
          <button
            onClick={handleClaim}
            disabled={isLoading || !hasRewards}
            className={`
              w-full py-3 rounded-xl font-semibold transition-all duration-300
              ${
                hasRewards
                  ? "bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:shadow-lg hover:shadow-[#14F195]/30 hover:-translate-y-0.5"
                  : "bg-trench-border text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Claiming...
              </span>
            ) : hasRewards ? (
              "Claim SOL Rewards"
            ) : (
              "No Rewards Yet"
            )}
          </button>
        </>
      )}

      {/* Stats */}
      <div className="mt-6 pt-6 border-t border-trench-border">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">Total Claimed</span>
          <span className="font-mono text-white">
            {userStake?.totalRewardsClaimed?.toFixed(4) || "0"} SOL
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Your Stake</span>
          <span className="font-mono text-trench-accent">
            {userStake?.stakedAmount?.toLocaleString() || "0"} ${TOKEN_TICKER}
          </span>
        </div>
      </div>
    </div>
  );
}
