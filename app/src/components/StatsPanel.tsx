"use client";

import { useState } from "react";
import { useStaking } from "@/hooks/useStaking";

const TOKEN_TICKER = "KryptCash";

export function StatsPanel() {
  const { poolInfo, userStake, isConfigured, refreshPoolInfo } = useStaking();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPoolInfo();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="gradient-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-trench-accent animate-pulse" />
          Staking Info
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-md hover:bg-trench-card transition-colors group"
          title="Refresh stats"
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
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-trench-accent/10 border border-trench-accent/20">
            <p className="text-sm text-trench-accent font-medium mb-2">🚀 Coming Soon</p>
            <p className="text-xs text-gray-400">
              $KryptCash staking launches after token graduates on pump.fun
            </p>
          </div>
          
          <div className="space-y-3">
            <StatRow
              label="Reward Token"
              value="SOL"
              icon="◎"
              accent
            />
            <StatRow
              label="Lock Period"
              value="None"
              icon="🔓"
            />
            <StatRow
              label="Min Stake"
              value="1,000,000"
              suffix={`$${TOKEN_TICKER}`}
              icon="📊"
            />
            <StatRow
              label="Fee Source"
              value="PumpSwap"
              icon="🔄"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <StatRow
            label="Total Staked"
            value={poolInfo?.totalStaked?.toLocaleString() || "0"}
            suffix={`$${TOKEN_TICKER}`}
            icon="📊"
          />
          <StatRow
            label="Stakers"
            value={poolInfo?.stakerCount?.toString() || "0"}
            icon="👥"
          />
          <StatRow
            label="Reward Token"
            value="SOL"
            icon="◎"
            accent
          />
          <StatRow
            label="Lock Period"
            value="None"
            icon="🔓"
          />
        </div>
      )}

      {/* Your position */}
      {userStake && userStake.stakedAmount > 0 && (
        <div className="mt-6 pt-6 border-t border-trench-border">
          <h4 className="text-sm text-gray-400 mb-3">Your Position</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Pool Share</span>
              <span className="font-mono text-trench-accent">
                {userStake.poolShare.toFixed(4)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Your Stake</span>
              <span className="font-mono text-white text-sm">
                {userStake.stakedAmount.toLocaleString()} ${TOKEN_TICKER}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Fee structure */}
      <div className="mt-6 pt-6 border-t border-trench-border">
        <h4 className="text-sm text-gray-400 mb-3">Revenue Sources</h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Creator Fee</span>
            <span className="font-mono text-trench-accent">0.05%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">LP Fee</span>
            <span className="font-mono text-trench-cyan">0.20%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Protocol</span>
            <span className="font-mono text-gray-400">0.05%</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-3">
          Trading fees from PumpSwap are distributed to stakers as SOL
        </p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  suffix,
  icon,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`font-mono ${accent ? "text-trench-accent" : "text-white"}`}>
          {value}
        </span>
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}
