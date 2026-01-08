"use client";

import { useState } from "react";
import { useStaking } from "@/hooks/useStaking";
import { toast } from "react-hot-toast";

// KryptCash Token Icon
function TokenIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="rounded-full"
    >
      <circle cx="50" cy="50" r="50" fill="#0d1117" />
      <path
        d="M50 25L68 37V63L50 75L32 63V37L50 25Z"
        stroke="white"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="68" cy="30" r="5" fill="#00ff88" />
      <circle cx="68" cy="70" r="5" fill="#00b4d8" />
      <line x1="50" y1="25" x2="68" y2="30" stroke="#00ff88" strokeWidth="2" />
      <line x1="50" y1="75" x2="68" y2="70" stroke="#00b4d8" strokeWidth="2" />
    </svg>
  );
}

type Tab = "stake" | "unstake";

const TOKEN_TICKER = "KryptCash";
const MIN_STAKE = 1_000_000; // 1M tokens minimum

export function StakingCard() {
  const [activeTab, setActiveTab] = useState<Tab>("stake");
  const [amount, setAmount] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    stake,
    unstake,
    userStake,
    tokenBalance,
    isLoading,
    isConfigured,
    refreshBalance,
    refreshUserStake,
  } = useStaking();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshBalance(), refreshUserStake()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const numAmount = parseFloat(amount);

    if (activeTab === "stake" && numAmount < MIN_STAKE) {
      toast.error(`Minimum stake is ${MIN_STAKE.toLocaleString()} $${TOKEN_TICKER}`);
      return;
    }

    try {
      if (activeTab === "stake") {
        await stake(numAmount);
        toast.success(`Successfully staked ${numAmount.toLocaleString()} $${TOKEN_TICKER}!`);
      } else {
        await unstake(numAmount);
        toast.success(`Successfully unstaked ${numAmount.toLocaleString()} $${TOKEN_TICKER}!`);
      }
      setAmount("");
    } catch (err: any) {
      toast.error(err.message || "Transaction failed");
    }
  };

  const handleMaxClick = () => {
    if (activeTab === "stake") {
      setAmount(tokenBalance?.toString() || "0");
    } else {
      setAmount(userStake?.stakedAmount.toString() || "0");
    }
  };

  const maxAmount =
    activeTab === "stake" ? tokenBalance : userStake?.stakedAmount;

  const meetsMinimum = activeTab === "unstake" || parseFloat(amount || "0") >= MIN_STAKE;

  return (
    <div className="gradient-border p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          <span className="gradient-text">${TOKEN_TICKER}</span> Staking
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-trench-accent/10 border border-trench-accent/20">
          <span className="text-xs text-trench-accent">Rewards in SOL</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 p-1 bg-trench-darker rounded-xl">
        <TabButton
          active={activeTab === "stake"}
          onClick={() => setActiveTab("stake")}
        >
          Stake
        </TabButton>
        <TabButton
          active={activeTab === "unstake"}
          onClick={() => setActiveTab("unstake")}
        >
          Unstake
        </TabButton>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">Amount</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Balance:{" "}
              <span className="text-white font-mono">
                {maxAmount?.toLocaleString() || "0"} ${TOKEN_TICKER}
              </span>
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 rounded-md hover:bg-trench-card transition-colors group"
              title="Refresh balance"
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
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-5 py-4 bg-trench-darker border border-trench-border rounded-xl text-2xl font-mono focus:outline-none focus:border-trench-accent transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              onClick={handleMaxClick}
              className="px-3 py-1 text-xs font-semibold bg-trench-accent/10 text-trench-accent rounded-lg hover:bg-trench-accent/20 transition-colors"
            >
              MAX
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-trench-card rounded-lg">
              <TokenIcon size={24} />
              <span className="font-semibold">${TOKEN_TICKER}</span>
            </div>
          </div>
        </div>
        {activeTab === "stake" && !meetsMinimum && amount && (
          <p className="text-xs text-trench-warning mt-2">
            Minimum stake: {MIN_STAKE.toLocaleString()} ${TOKEN_TICKER}
          </p>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <InfoCard
          label="Your Staked"
          value={`${userStake?.stakedAmount?.toLocaleString() || 0}`}
          subValue={`$${TOKEN_TICKER}`}
        />
        <InfoCard
          label="Pending Rewards"
          value={`${userStake?.pendingRewards?.toFixed(6) || 0}`}
          subValue="SOL"
          accent
        />
        <InfoCard
          label="Lock Period"
          value="None"
          subValue="Claim anytime"
        />
        <InfoCard
          label="Min Stake"
          value={MIN_STAKE.toLocaleString()}
          subValue={`$${TOKEN_TICKER}`}
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !amount || !meetsMinimum || !isConfigured}
        className={`
          w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300
          ${
            isLoading || !amount || !meetsMinimum || !isConfigured
              ? "bg-trench-border text-gray-500 cursor-not-allowed"
              : activeTab === "stake"
              ? "bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black hover:shadow-lg hover:shadow-trench-accent/30 hover:-translate-y-0.5"
              : "bg-gradient-to-r from-trench-pink to-trench-purple text-white hover:shadow-lg hover:shadow-trench-purple/30 hover:-translate-y-0.5"
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
            Processing...
          </span>
        ) : !isConfigured ? (
          "Coming Soon - Launching on pump.fun"
        ) : (
          `${activeTab === "stake" ? "Stake" : "Unstake"} $${TOKEN_TICKER}`
        )}
      </button>

      {/* Transaction Info */}
      <div className="mt-6 pt-6 border-t border-trench-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Network Fee</span>
          <span className="text-gray-300">~0.00005 SOL</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-400">
            {activeTab === "stake" ? "You will stake" : "You will receive"}
          </span>
          <span className="text-trench-accent font-semibold">
            {parseFloat(amount || "0").toLocaleString()} ${TOKEN_TICKER}
          </span>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 py-3 rounded-lg font-semibold transition-all duration-300
        ${
          active
            ? "bg-trench-card text-white shadow-lg"
            : "text-gray-400 hover:text-white"
        }
      `}
    >
      {children}
    </button>
  );
}

function InfoCard({
  label,
  value,
  subValue,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  accent?: boolean;
}) {
  return (
    <div className="p-4 bg-trench-darker rounded-xl border border-trench-border">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <p
          className={`text-lg font-semibold font-mono ${
            accent ? "text-trench-accent" : "text-white"
          }`}
        >
          {value}
        </p>
        {subValue && (
          <span className="text-xs text-gray-500">{subValue}</span>
        )}
      </div>
    </div>
  );
}
