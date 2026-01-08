"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { KryptCashLogo } from "./KryptCashLogo";

export function Header() {
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering wallet button after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (publicKey) {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com"
      );
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    } else {
      setBalance(null);
    }
  }, [publicKey]);

  return (
    <header className="border-b border-trench-border/50 backdrop-blur-xl bg-trench-black/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <KryptCashLogo size={44} />
          <div>
            <h1 className="font-bold text-xl tracking-tight">
              <span className="text-white">KRYPT</span>
              <span className="text-trench-accent">CASH</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
              Money Tools Built With Love
            </p>
          </div>
        </a>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="/stake"
            className="text-sm text-gray-400 hover:text-trench-accent transition-colors"
          >
            Stake
          </a>
          <a
            href="/cards"
            className="text-sm text-gray-400 hover:text-trench-accent transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Cards
          </a>
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-trench-accent transition-colors"
          >
            pump.fun
          </a>
        </nav>

        {/* Wallet & Social Links */}
        <div className="flex items-center gap-3">
          {/* Social Links */}
          <div className="hidden sm:flex items-center gap-1">
            <a
              href="https://x.com/KryptCashSol"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-trench-card transition-colors group"
              title="Follow us on X"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://t.me/kryptcash_sol"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-trench-card transition-colors group"
              title="Join our Telegram"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-[#26A5E4] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </a>
            <a
              href="https://discord.gg/xFb8vf9hcT"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-trench-card transition-colors group"
              title="Join our Discord"
            >
              <svg className="w-4 h-4 text-gray-400 group-hover:text-[#5865F2] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
              </svg>
            </a>
          </div>

          {mounted && connected && balance !== null && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-trench-card border border-trench-border">
              <div className="w-2 h-2 rounded-full bg-trench-accent animate-pulse" />
              <span className="text-sm font-mono">
                {balance.toFixed(4)} SOL
              </span>
            </div>
          )}
          {mounted ? (
            <WalletMultiButton />
          ) : (
            <div className="h-[48px] w-[168px] rounded-lg bg-trench-card animate-pulse" />
          )}
        </div>
      </div>
    </header>
  );
}
