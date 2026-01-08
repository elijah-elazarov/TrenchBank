"use client";

import { Header } from "@/components/Header";
import { KryptCashLogo } from "@/components/KryptCashLogo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-trench-black">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-trench-accent/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-trench-purple/8 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-trench-cyan/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Header />

        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-16 pb-24">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-trench-accent/10 to-trench-cyan/10 border border-trench-accent/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-trench-accent animate-pulse" />
              <span className="text-sm text-trench-accent font-semibold">Built on Solana</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm text-gray-400">Powered by PumpSwap</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tight leading-none">
              <span className="text-white">Money Tools</span>
              <br />
              <span className="bg-gradient-to-r from-trench-accent via-trench-cyan to-trench-accent bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Built With Love
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Stake your tokens. Earn real SOL. Spend with virtual cards.
              <span className="text-white font-medium"> All in one place.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/stake"
                className="group px-8 py-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-bold text-lg hover:shadow-2xl hover:shadow-trench-accent/30 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
              >
                Start Staking
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/cards"
                className="px-8 py-4 rounded-xl bg-trench-card border border-trench-border text-white font-bold text-lg hover:border-trench-accent/50 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Get a Card
              </Link>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              <StatItem value="0%" label="Lock Period" />
              <StatItem value="SOL" label="Reward Token" highlight />
              <StatItem value="1M" label="Min Stake" />
              <StatItem value="24/7" label="Claim Anytime" />
            </div>
          </div>
        </section>

        {/* Feature Showcases */}
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-6xl mx-auto">
            {/* Staking Feature */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
              {/* Left - Visual */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-trench-accent/20 to-transparent rounded-3xl blur-3xl" />
                <div className="relative bg-gradient-to-br from-trench-card to-trench-darker rounded-3xl border border-trench-border p-8 overflow-hidden">
                  {/* Mock Staking UI */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <KryptCashLogo size={48} />
                        <div>
                          <p className="font-bold text-white">$KryptCash Staking</p>
                          <p className="text-sm text-gray-400">Earn SOL rewards</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-trench-accent">0.0842</p>
                        <p className="text-xs text-gray-400">SOL earned</p>
                      </div>
                    </div>
                    
                    <div className="h-px bg-gradient-to-r from-transparent via-trench-border to-transparent" />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-trench-black/50">
                        <p className="text-xs text-gray-400 mb-1">Your Stake</p>
                        <p className="text-lg font-bold font-mono">5,000,000</p>
                      </div>
                      <div className="p-4 rounded-xl bg-trench-black/50">
                        <p className="text-xs text-gray-400 mb-1">Pool Share</p>
                        <p className="text-lg font-bold font-mono text-trench-accent">2.4%</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-1 py-3 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-center font-semibold text-trench-black">
                        Stake
                      </div>
                      <div className="flex-1 py-3 rounded-xl bg-trench-card border border-trench-border text-center font-semibold text-gray-400">
                        Unstake
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative elements */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-trench-accent/10 rounded-full blur-2xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-trench-cyan/10 rounded-full blur-2xl" />
                </div>
              </div>

              {/* Right - Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-trench-accent/10 border border-trench-accent/20 mb-4">
                  <span className="text-xs text-trench-accent font-semibold uppercase tracking-wider">Staking</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  <span className="text-white">Stake & Earn</span>
                  <br />
                  <span className="text-trench-accent">Real SOL</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Your $KryptCash tokens work for you. Stake them to earn a share of trading fees 
                  paid out in native SOL — not inflationary tokens. No lock period means you're 
                  always in control.
                </p>
                <ul className="space-y-3 mb-8">
                  <FeatureListItem text="0.25% of all trading fees go to stakers" />
                  <FeatureListItem text="Instant unstake — no waiting period" />
                  <FeatureListItem text="Claim rewards anytime, 24/7" />
                  <FeatureListItem text="Minimum 1M tokens to participate" />
                </ul>
                <Link
                  href="/stake"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-trench-accent text-trench-black font-semibold hover:bg-trench-accent/90 transition-colors"
                >
                  Go to Staking
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Cards Feature */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left - Content */}
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-trench-cyan/10 border border-trench-cyan/20 mb-4">
                  <span className="text-xs text-trench-cyan font-semibold uppercase tracking-wider">Cards</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  <span className="text-white">Spend Crypto</span>
                  <br />
                  <span className="text-trench-cyan">Anywhere</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Convert your crypto to spendable virtual debit cards in seconds. 
                  Shop online, pay bills, or subscribe to services — all without 
                  leaving the crypto ecosystem.
                </p>
                <ul className="space-y-3 mb-8">
                  <FeatureListItem text="Instant card creation, no KYC" color="cyan" />
                  <FeatureListItem text="Works with any online merchant" color="cyan" />
                  <FeatureListItem text="Fund with SOL, USDC, or other tokens" color="cyan" />
                  <FeatureListItem text="Freeze & unfreeze anytime" color="cyan" />
                </ul>
                <Link
                  href="/cards"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-trench-cyan text-trench-black font-semibold hover:bg-trench-cyan/90 transition-colors"
                >
                  Get Your Card
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Right - Visual */}
              <div className="relative order-1 lg:order-2">
                <div className="absolute inset-0 bg-gradient-to-br from-trench-cyan/20 to-transparent rounded-3xl blur-3xl" />
                <div className="relative">
                  {/* Stacked Cards */}
                  <div className="relative h-72">
                    {/* Back card */}
                    <div className="absolute top-8 left-8 right-0 h-48 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 transform rotate-6 shadow-2xl" />
                    {/* Middle card */}
                    <div className="absolute top-4 left-4 right-4 h-48 rounded-2xl bg-gradient-to-br from-trench-purple to-trench-pink transform rotate-3 shadow-2xl" />
                    {/* Front card */}
                    <div className="absolute top-0 left-0 right-8 h-48 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-5 shadow-2xl overflow-hidden">
                      {/* Card content */}
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <p className="text-white/60 text-xs uppercase tracking-wider">KryptCash</p>
                          <p className="text-white/80 text-xs">Virtual Debit</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-6 rounded bg-gradient-to-br from-amber-300 to-amber-500" />
                          <svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-white font-mono text-lg tracking-widest mb-6">
                        •••• •••• •••• 4521
                      </p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-white/60 text-[10px] uppercase">Cardholder</p>
                          <p className="text-white text-sm font-medium">KRYPTCASH USER</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-[10px] uppercase">Balance</p>
                          <p className="text-white text-sm font-bold">$247.50</p>
                        </div>
                      </div>
                      {/* Decorative circles */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
                      <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="text-white">Why</span>
                <span className="text-trench-accent"> KryptCash?</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <BenefitCard
                icon="💎"
                title="Real Yield"
                description="No token inflation. You earn actual SOL from real trading fees — sustainable economics."
              />
              <BenefitCard
                icon="⚡"
                title="Zero Lock"
                description="Your tokens, your control. Stake and unstake instantly with no waiting periods."
              />
              <BenefitCard
                icon="🌍"
                title="Spend Anywhere"
                description="Convert crypto to virtual cards and shop at millions of merchants worldwide."
              />
              <BenefitCard
                icon="🔒"
                title="Non-Custodial"
                description="Your keys, your crypto. We never hold your tokens — everything is on-chain."
              />
              <BenefitCard
                icon="🚀"
                title="Low Fees"
                description="Built on Solana for lightning-fast transactions at a fraction of a cent."
              />
              <BenefitCard
                icon="🎯"
                title="Transparent"
                description="All rewards come from verifiable on-chain trading activity. No hidden mechanics."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-trench-accent/20 via-trench-card to-trench-purple/20" />
              <div className="absolute inset-0 backdrop-blur-sm" />
              
              {/* Content */}
              <div className="relative p-12 md:p-16 text-center">
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  <span className="text-white">Ready to Start</span>
                  <br />
                  <span className="text-trench-accent">Earning?</span>
                </h2>
                <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
                  Join the KryptCash ecosystem today. Stake your tokens, earn SOL, 
                  and unlock the full potential of your crypto.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/stake"
                    className="px-10 py-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-bold text-lg hover:shadow-2xl hover:shadow-trench-accent/30 transition-all"
                  >
                    Start Staking Now
                  </Link>
                  <a
                    href="https://pump.fun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-10 py-4 rounded-xl border border-trench-border text-white font-semibold hover:border-trench-accent/50 transition-colors"
                  >
                    Buy on pump.fun
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-12 border-t border-trench-border/30">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <KryptCashLogo size={40} />
              <span className="font-bold text-white">KryptCash</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-gray-400">
              <Link href="/stake" className="hover:text-trench-accent transition-colors">Stake</Link>
              <Link href="/cards" className="hover:text-trench-accent transition-colors">Cards</Link>
              <a href="https://pump.fun" target="_blank" rel="noopener noreferrer" className="hover:text-trench-accent transition-colors">pump.fun</a>
            </div>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/KryptCashSol"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-trench-card border border-trench-border hover:border-trench-accent/50 transition-all group"
                title="Follow us on X"
              >
                <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://t.me/kryptcash_sol"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-trench-card border border-trench-border hover:border-[#26A5E4]/50 transition-all group"
                title="Join our Telegram"
              >
                <svg className="w-5 h-5 text-gray-400 group-hover:text-[#26A5E4] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/xFb8vf9hcT"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-trench-card border border-trench-border hover:border-[#5865F2]/50 transition-all group"
                title="Join our Discord"
              >
                <svg className="w-5 h-5 text-gray-400 group-hover:text-[#5865F2] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
              </a>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 KryptCash. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function StatItem({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-3xl md:text-4xl font-bold ${highlight ? 'text-trench-accent' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-sm text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function FeatureListItem({ text, color = "accent" }: { text: string; color?: "accent" | "cyan" }) {
  return (
    <li className="flex items-center gap-3 text-gray-300">
      <svg className={`w-5 h-5 flex-shrink-0 ${color === "cyan" ? "text-trench-cyan" : "text-trench-accent"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </li>
  );
}

function BenefitCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-trench-card/30 border border-trench-border hover:border-trench-accent/30 transition-all group">
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
