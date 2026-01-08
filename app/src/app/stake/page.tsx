"use client";

import { Header } from "@/components/Header";
import { StakingCard } from "@/components/StakingCard";
import { StatsPanel } from "@/components/StatsPanel";
import { RewardsPanel } from "@/components/RewardsPanel";
import { useWallet } from "@solana/wallet-adapter-react";

export default function StakePage() {
  const { connected } = useWallet();

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-trench-black">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-trench-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-trench-purple/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-trench-accent/10 border border-trench-accent/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-trench-accent animate-pulse" />
              <span className="text-sm text-trench-accent font-medium">Powered by PumpSwap</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              <span className="text-white">Stake </span>
              <span className="gradient-text">$KryptCash</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Earn real SOL rewards from PumpSwap trading fees.
              <span className="text-trench-accent"> No lock period. Claim anytime.</span>
            </p>
          </div>

          {connected ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Left column - Stats */}
              <div className="lg:col-span-1 space-y-6">
                <StatsPanel />
                <RewardsPanel />
              </div>

              {/* Right column - Staking card */}
              <div className="lg:col-span-2">
                <StakingCard />
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto">
              <div className="gradient-border p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-trench-accent/10 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-trench-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
                <p className="text-gray-400 mb-6">
                  Connect your Solana wallet to stake $KryptCash and earn SOL rewards from trading fees.
                </p>
                <div className="text-sm text-gray-500">
                  Supports Phantom, Solflare, Coinbase, Ledger & more
                </div>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon="💎"
              title="Real Yield"
              description="Earn actual SOL from PumpSwap trading fees. No inflationary token rewards."
            />
            <FeatureCard
              icon="⚡"
              title="Instant Access"
              description="No lock period. Stake and unstake anytime with low gas fees on Solana."
            />
            <FeatureCard
              icon="🔥"
              title="Fee-Powered"
              description="0.05% creator fees + 0.20% LP fees flow directly to stakers as SOL."
            />
          </div>

          {/* How it works */}
          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">
              <span className="gradient-text">How It Works</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StepCard
                number="1"
                title="Hold $KryptCash"
                description="Get 1M+ tokens on pump.fun or PumpSwap"
              />
              <StepCard
                number="2"
                title="Stake"
                description="Deposit your tokens to the staking pool"
              />
              <StepCard
                number="3"
                title="Fees Accrue"
                description="Every trade generates SOL rewards"
              />
              <StepCard
                number="4"
                title="Claim SOL"
                description="Withdraw rewards anytime you want"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-trench-card/50 border border-trench-border hover:border-trench-accent/30 transition-all duration-300 group">
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative p-5 rounded-xl bg-trench-card/30 border border-trench-border">
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-trench-accent to-trench-cyan flex items-center justify-center text-trench-black font-bold text-sm">
        {number}
      </div>
      <h4 className="font-semibold mt-2 mb-1">{title}</h4>
      <p className="text-gray-400 text-xs">{description}</p>
    </div>
  );
}

