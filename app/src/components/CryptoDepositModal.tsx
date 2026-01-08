"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import {
  CryptoCurrency,
  CryptoNetwork,
  CryptoDepositRequest,
  createCryptoDeposit,
  updateCryptoDeposit,
  completeCryptoDeposit,
  cancelCryptoDeposit,
  getPendingCryptoDeposits,
  isTransactionUsed,
  markTransactionUsed,
  NETWORK_CONFIG,
} from "@/lib/crypto-deposit";
import { depositClient } from "@/lib/deposit";

interface CryptoDepositModalProps {
  walletAddress: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

interface PriceData {
  symbol: string;
  price: number;
}

// Deposit Fee Structure (2% + $5)
const DEPOSIT_FEE_PERCENT = 0.02; // 2%
const DEPOSIT_FEE_FLAT = 5.00; // $5

// Calculate fees when you know the GROSS amount (what user sends)
function calculateFeesFromGross(grossAmount: number) {
  const percentFee = grossAmount * DEPOSIT_FEE_PERCENT;
  const totalFee = percentFee + DEPOSIT_FEE_FLAT;
  const netAmount = grossAmount - totalFee;
  return {
    grossAmount,
    percentFee,
    flatFee: DEPOSIT_FEE_FLAT,
    totalFee,
    netAmount: Math.max(0, netAmount),
  };
}

// Calculate gross amount when you know the NET amount (what user wants to receive)
// Formula: net = gross - (gross * 0.02 + 5) => gross = (net + 5) / 0.98
function calculateGrossFromNet(netAmount: number) {
  const grossAmount = (netAmount + DEPOSIT_FEE_FLAT) / (1 - DEPOSIT_FEE_PERCENT);
  const percentFee = grossAmount * DEPOSIT_FEE_PERCENT;
  const totalFee = percentFee + DEPOSIT_FEE_FLAT;
  return {
    grossAmount,
    percentFee,
    flatFee: DEPOSIT_FEE_FLAT,
    totalFee,
    netAmount,
  };
}

// Legacy function for compatibility
function calculateDepositFees(amount: number) {
  return calculateFeesFromGross(amount);
}

type DepositStep = "pending" | "select" | "payment" | "verify" | "complete";

export function CryptoDepositModal({ walletAddress, onClose, onSuccess }: CryptoDepositModalProps) {
  const [step, setStep] = useState<DepositStep>("select");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<CryptoCurrency>("USDT");
  const [network, setNetwork] = useState<CryptoNetwork>("solana");
  const [deposit, setDeposit] = useState<CryptoDepositRequest | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<CryptoDepositRequest[]>([]);
  const [txSignature, setTxSignature] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, PriceData>>({
    SOL: { symbol: "SOL", price: 185 },
    ETH: { symbol: "ETH", price: 3200 },
    USDT: { symbol: "USDT", price: 1 },
  });
  const [copied, setCopied] = useState(false);

  // Check for pending deposits on mount
  useEffect(() => {
    const pending = getPendingCryptoDeposits(walletAddress);
    setPendingDeposits(pending);
    // If there are pending deposits, show them first
    if (pending.length > 0) {
      setStep("pending");
    }
  }, [walletAddress]);

  // Fetch current prices
  useEffect(() => {
    fetch("/api/crypto-deposit/prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPrices(data.data);
        }
      })
      .catch(console.error);
  }, []);

  // User enters NET amount (what they want to receive)
  // We calculate GROSS amount (what they need to send, including fees)
  const netAmount = parseFloat(amount) || 0;
  const feeCalc = calculateGrossFromNet(netAmount);
  const grossAmount = feeCalc.grossAmount;
  
  // Convert GROSS to crypto (this is what user actually sends)
  const cryptoAmount = currency === "USDT" 
    ? grossAmount
    : grossAmount / (prices[currency]?.price || 1);

  // Handle currency/network selection
  const handleCurrencySelect = (cur: CryptoCurrency) => {
    setCurrency(cur);
    // Auto-select network based on currency
    if (cur === "ETH") {
      setNetwork("ethereum");
    } else if (cur === "SOL") {
      setNetwork("solana");
    }
    // USDT can be on either network, default to Solana
  };

  // Create deposit request
  const handleCreateDeposit = async () => {
    // User enters NET amount (what they want to receive)
    if (isNaN(netAmount) || netAmount < 20) {
      toast.error("Minimum amount to receive is $20");
      return;
    }

    setIsLoading(true);
    try {
      // Send GROSS amount to API (what user will actually send)
      const response = await fetch("/api/crypto-deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          amount: grossAmount, // Gross amount (including fees)
          netAmount: netAmount, // Net amount (what user receives)
          currency,
          network,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Store locally with both amounts
        const localDeposit = createCryptoDeposit({
          walletAddress,
          amount: grossAmount, // Store gross as the deposit amount
          currency,
          network,
          depositAddress: data.data.depositAddress,
        });
        
        // Use the server-generated data but keep local tracking
        setDeposit({ ...localDeposit, ...data.data, netAmount });
        setStep("payment");
      } else {
        toast.error(data.message || "Failed to create deposit");
      }
    } catch (error) {
      toast.error("Failed to create deposit request");
    } finally {
      setIsLoading(false);
    }
  };

  // Copy address to clipboard
  const copyAddress = () => {
    if (deposit?.depositAddress) {
      navigator.clipboard.writeText(deposit.depositAddress);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Copy amount to clipboard
  const copyAmount = () => {
    navigator.clipboard.writeText(cryptoAmount.toFixed(currency === "USDT" ? 2 : 6));
    toast.success("Amount copied!");
  };

  // Handle verify step
  const handleProceedToVerify = () => {
    setStep("verify");
  };

  // Select a pending deposit to verify
  const handleSelectPendingDeposit = (pendingDeposit: CryptoDepositRequest) => {
    setDeposit(pendingDeposit);
    setCurrency(pendingDeposit.currency);
    setNetwork(pendingDeposit.network);
    setStep("verify");
  };

  // Refresh pending deposits list
  const refreshPendingDeposits = () => {
    const pending = getPendingCryptoDeposits(walletAddress);
    setPendingDeposits(pending);
  };

  // Cancel a pending deposit
  const handleCancelDeposit = (depositId: string) => {
    if (confirm("Are you sure you want to cancel this deposit? If you already sent funds, they will NOT be refunded.")) {
      cancelCryptoDeposit(depositId);
      refreshPendingDeposits();
      toast.success("Deposit cancelled");
      
      // If no more pending deposits, go to select step
      const remaining = getPendingCryptoDeposits(walletAddress);
      if (remaining.length === 0) {
        setStep("select");
      }
    }
  };

  // Verify transaction
  const handleVerifyTransaction = async () => {
    if (!txSignature.trim()) {
      toast.error("Please enter the transaction signature");
      return;
    }

    if (!deposit) {
      toast.error("No deposit request found");
      return;
    }

    // Check if this transaction has already been used (client-side check)
    if (isTransactionUsed(txSignature)) {
      toast.error("This transaction has already been used to verify a deposit.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/crypto-deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositId: deposit.id,
          txSignature: txSignature.trim(),
          network: deposit.network,
          currency: deposit.currency,
          expectedAmount: deposit.cryptoAmount,
          depositAddress: deposit.depositAddress,
          walletAddress,
        }),
      });

      const data = await response.json();

      if (data.success && data.data.verified) {
        // Mark transaction as used (client-side tracking)
        markTransactionUsed(txSignature);
        
        // Mark deposit as complete locally
        completeCryptoDeposit(deposit.id, txSignature);
        
        // Use stored netAmount or calculate from gross
        const creditAmount = deposit.netAmount || calculateFeesFromGross(deposit.amount).netAmount;
        const feeAmount = deposit.amount - creditAmount;
        
        // Credit balance (net amount after fees)
        const balanceResult = await depositClient.updateBalance({
          walletAddress,
          action: "credit",
          amount: creditAmount,
        });

        if (!balanceResult.success) {
          console.error("Failed to credit balance:", balanceResult.message);
          toast.error("Transaction verified but failed to credit balance. Please contact support.");
          return;
        }

        // Refresh pending list
        refreshPendingDeposits();
        
        setStep("complete");
        onSuccess(creditAmount);
        toast.success(`$${creditAmount.toFixed(2)} credited to your balance! (Fee: $${feeAmount.toFixed(2)})`);
      } else {
        toast.error(data.message || "Transaction verification failed");
      }
    } catch (error) {
      toast.error("Failed to verify transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on step
  const renderStep = () => {
    switch (step) {
      case "pending":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Pending Deposits</h3>
            <p className="text-gray-400 text-sm mb-4">
              You have unverified deposits. Verify them to credit your balance.
            </p>

            {/* Pending Deposits List */}
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {pendingDeposits.map((pending) => (
                <div
                  key={pending.id}
                  className="bg-trench-black/50 rounded-xl p-4 border border-yellow-500/30"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-white">
                        {pending.cryptoAmount.toFixed(pending.currency === "USDT" ? 2 : 6)} {pending.currency}
                      </p>
                      <p className="text-sm text-gray-400">≈ ${pending.amount.toFixed(2)}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                      Pending
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    <p>Reference: <code className="text-yellow-300">{pending.reference}</code></p>
                    <p>Created: {new Date(pending.createdAt).toLocaleString()}</p>
                    <p className="truncate">To: {pending.depositAddress}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectPendingDeposit(pending)}
                      className="flex-1 py-2 px-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleCancelDeposit(pending.id)}
                      className="py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setStep("select")}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity"
              >
                New Deposit
              </button>
            </div>
          </>
        );

      case "select":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Deposit Crypto</h3>
            <p className="text-gray-400 text-sm mb-2">
              Deposit SOL, USDT, or ETH directly. No third-party processors.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-400">
                ℹ️ Deposit fee: <span className="font-semibold">2% + $5</span>
              </p>
            </div>

            {/* Pending deposits notice */}
            {pendingDeposits.length > 0 && (
              <button
                onClick={() => setStep("pending")}
                className="w-full mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-left hover:bg-yellow-500/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-sm text-yellow-400">
                      {pendingDeposits.length} pending deposit{pendingDeposits.length > 1 ? 's' : ''} to verify
                    </span>
                  </div>
                  <span className="text-yellow-400">→</span>
                </div>
              </button>
            )}

            {/* Amount Input - User enters what they want to RECEIVE */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount to receive (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min="20"
                  step="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 rounded-xl bg-trench-card border border-trench-border focus:border-trench-accent focus:outline-none text-white"
                  placeholder="50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum: $20 (you&apos;ll send ~${(20 + 5) / 0.98 > 0 ? ((20 + 5) / 0.98).toFixed(2) : '25.51'} after fees)</p>
            </div>

            {/* Currency Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select Currency</label>
              <div className="grid grid-cols-3 gap-2">
                {(["SOL", "USDT", "ETH"] as CryptoCurrency[]).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => handleCurrencySelect(cur)}
                    className={`p-3 rounded-xl border transition-all ${
                      currency === cur
                        ? "bg-trench-accent/20 border-trench-accent"
                        : "bg-trench-card border-trench-border hover:border-trench-accent/50"
                    }`}
                  >
                    <div className="text-lg font-bold">{cur}</div>
                    <div className="text-xs text-gray-400">
                      ${prices[cur]?.price.toLocaleString() || "..."}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Network Selection (for USDT) */}
            {currency === "USDT" && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Select Network</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNetwork("solana")}
                    className={`p-3 rounded-xl border transition-all ${
                      network === "solana"
                        ? "bg-trench-accent/20 border-trench-accent"
                        : "bg-trench-card border-trench-border hover:border-trench-accent/50"
                    }`}
                  >
                    <div className="font-semibold">Solana</div>
                    <div className="text-xs text-gray-400">Fast & cheap</div>
                  </button>
                  <button
                    onClick={() => setNetwork("ethereum")}
                    className={`p-3 rounded-xl border transition-all ${
                      network === "ethereum"
                        ? "bg-trench-accent/20 border-trench-accent"
                        : "bg-trench-card border-trench-border hover:border-trench-accent/50"
                    }`}
                  >
                    <div className="font-semibold">Ethereum</div>
                    <div className="text-xs text-gray-400">ERC-20</div>
                  </button>
                </div>
              </div>
            )}

            {/* Fee Breakdown */}
            {(() => {
              const validAmount = netAmount >= 20;
              
              return (
                <div className="bg-trench-black/50 rounded-xl p-4 mb-6 border border-trench-border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">You&apos;ll send</span>
                    <span className="text-white font-mono">
                      {cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">USD Value (gross)</span>
                    <span className="text-white">${grossAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Network</span>
                    <span className="text-white">{NETWORK_CONFIG[network].name}</span>
                  </div>
                  {validAmount && (
                    <>
                      <div className="border-t border-trench-border my-2" />
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Deposit Fee (2% + $5)</span>
                        <span className="text-red-400">-${feeCalc.totalFee.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-trench-border my-2" />
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-300">You&apos;ll receive</span>
                        <span className="text-trench-cyan">${netAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDeposit}
                disabled={isLoading || parseFloat(amount) < 20}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Continue"}
              </button>
            </div>
          </>
        );

      case "payment":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Send {currency}</h3>
            <p className="text-gray-400 text-sm mb-6">
              Send exactly the amount shown to the address below.
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={deposit?.depositAddress || ""}
                  size={160}
                  level="H"
                />
              </div>
            </div>

            {/* Amount to Send */}
            <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Amount to send</p>
                  <p className="text-xl font-bold font-mono text-trench-cyan">
                    {deposit?.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}
                  </p>
                </div>
                <button
                  onClick={copyAmount}
                  className="p-2 rounded-lg bg-trench-card hover:bg-trench-accent/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Deposit Address */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Deposit Address ({NETWORK_CONFIG[network].name})</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-trench-black/50 rounded-lg p-3 text-xs font-mono text-gray-300 break-all border border-trench-border">
                  {deposit?.depositAddress}
                </code>
                <button
                  onClick={copyAddress}
                  className={`p-3 rounded-lg transition-colors ${
                    copied ? "bg-trench-accent text-trench-black" : "bg-trench-card hover:bg-trench-accent/20"
                  }`}
                >
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Reference Code */}
            {deposit?.reference && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
                <p className="text-xs text-yellow-400 mb-1">Reference (include in memo if possible)</p>
                <code className="font-mono font-bold text-yellow-300">{deposit.reference}</code>
              </div>
            )}

            {/* Fee Breakdown */}
            {deposit && (
              <div className="bg-trench-black/50 rounded-xl p-3 mb-4 border border-trench-border">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">You&apos;re sending</span>
                  <span className="text-white">${deposit.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Fee (2% + $5)</span>
                  <span className="text-red-400">-${calculateFeesFromGross(deposit.amount).totalFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-trench-border my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-300">You&apos;ll receive</span>
                  <span className="text-trench-cyan">${(deposit.netAmount || calculateFeesFromGross(deposit.amount).netAmount).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6">
              <p className="text-xs text-red-400">
                ⚠️ Only send {currency} on {NETWORK_CONFIG[network].name}. Sending other tokens or using the wrong network will result in loss of funds.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("select")}
                className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleProceedToVerify}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity"
              >
                I&apos;ve Sent It
              </button>
            </div>
          </>
        );

      case "verify":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Verify Transaction</h3>
            <p className="text-gray-400 text-sm mb-6">
              Paste your transaction signature to verify the payment.
            </p>

            {/* Transaction Signature Input */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Transaction Signature</label>
              <textarea
                value={txSignature}
                onChange={(e) => setTxSignature(e.target.value)}
                placeholder={network === "solana" ? "e.g., 5xG7...abc" : "e.g., 0x123...abc"}
                className="w-full p-3 rounded-xl bg-trench-card border border-trench-border focus:border-trench-accent focus:outline-none text-white font-mono text-sm resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-2">
                Find this in your wallet&apos;s transaction history or on{" "}
                <a
                  href={NETWORK_CONFIG[network].explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-trench-cyan hover:underline"
                >
                  {network === "solana" ? "Solscan" : "Etherscan"}
                </a>
              </p>
            </div>

            {/* Expected Details */}
            <div className="bg-trench-black/50 rounded-xl p-4 mb-6 border border-trench-border">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Expected amount</span>
                <span className="text-white font-mono">
                  {deposit?.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">To address</span>
                <span className="text-white font-mono text-xs">
                  {deposit?.depositAddress.slice(0, 8)}...{deposit?.depositAddress.slice(-8)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("payment")}
                className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleVerifyTransaction}
                disabled={isLoading || !txSignature.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify & Credit"}
              </button>
            </div>
          </>
        );

      case "complete":
        const completeNetAmount = deposit?.netAmount || (deposit ? calculateFeesFromGross(deposit.amount).netAmount : 0);
        const completeFeeAmount = deposit ? deposit.amount - completeNetAmount : 0;
        return (
          <>
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-trench-accent/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-trench-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Deposit Complete!</h3>
              
              {/* Fee Breakdown */}
              {deposit && (
                <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border text-left">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">You sent</span>
                    <span className="text-white">${deposit.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Fee (2% + $5)</span>
                    <span className="text-red-400">-${completeFeeAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-trench-border my-2" />
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-300">Credited</span>
                    <span className="text-trench-cyan">${completeNetAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {deposit?.txSignature && (
                <a
                  href={`${NETWORK_CONFIG[network].explorer}${deposit.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-trench-cyan hover:underline"
                >
                  View on {network === "solana" ? "Solscan" : "Etherscan"} →
                </a>
              )}
            </div>

            {/* Show remaining pending deposits */}
            {pendingDeposits.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
                <p className="text-sm text-yellow-400">
                  You have {pendingDeposits.length} more pending deposit{pendingDeposits.length > 1 ? 's' : ''} to verify.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {pendingDeposits.length > 0 && (
                <button
                  onClick={() => setStep("pending")}
                  className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-yellow-500/30 text-yellow-400 font-semibold hover:bg-yellow-500/10 transition-colors"
                >
                  Verify More
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-trench-card border border-trench-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {renderStep()}
      </div>
    </div>
  );
}

