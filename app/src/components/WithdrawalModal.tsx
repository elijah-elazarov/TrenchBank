"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  WithdrawalCurrency,
  WithdrawalNetwork,
  MIN_WITHDRAWAL,
  WITHDRAWAL_FEES,
  NETWORK_FEES,
  calculateWithdrawal,
  isValidAddress,
  createWithdrawalLocal,
  updateWithdrawalLocal,
} from "@/lib/withdrawal";

interface WithdrawalModalProps {
  walletAddress: string;
  userBalance: number;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

interface PriceData {
  symbol: string;
  price: number;
}

type WithdrawalStep = "select" | "confirm" | "processing" | "complete" | "failed";

export function WithdrawalModal({ walletAddress, userBalance, onClose, onSuccess }: WithdrawalModalProps) {
  const [step, setStep] = useState<WithdrawalStep>("select");
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [currency, setCurrency] = useState<WithdrawalCurrency>("USDT");
  const [network, setNetwork] = useState<WithdrawalNetwork>("solana");
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, PriceData>>({
    SOL: { symbol: "SOL", price: 185 },
    ETH: { symbol: "ETH", price: 3200 },
    USDT: { symbol: "USDT", price: 1 },
  });
  const [withdrawalResult, setWithdrawalResult] = useState<{
    txSignature?: string;
    explorer?: string;
    error?: string;
  } | null>(null);

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

  // Calculate withdrawal details
  const amountNum = parseFloat(amount) || 0;
  const cryptoPrice = prices[currency]?.price || 1;
  const withdrawal = calculateWithdrawal(amountNum, currency, cryptoPrice);
  const minAmount = MIN_WITHDRAWAL[currency];
  const isValidAmount = amountNum >= minAmount && amountNum <= userBalance;
  const addressValid = destinationAddress ? isValidAddress(destinationAddress, network) : false;

  // Handle currency selection
  const handleCurrencySelect = (cur: WithdrawalCurrency) => {
    setCurrency(cur);
    if (cur === "ETH") {
      setNetwork("ethereum");
    } else if (cur === "SOL") {
      setNetwork("solana");
    }
  };

  // Handle max amount
  const handleMaxAmount = () => {
    setAmount(userBalance.toFixed(2));
  };

  // Handle withdrawal submission
  const handleSubmitWithdrawal = async () => {
    if (!isValidAmount || !addressValid) {
      toast.error("Please check your inputs");
      return;
    }

    setStep("confirm");
  };

  // Process the withdrawal
  const handleConfirmWithdrawal = async () => {
    setIsLoading(true);
    setStep("processing");

    try {
      // Step 1: Create withdrawal request
      const createResponse = await fetch("/api/withdrawal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          destinationAddress,
          amount: amountNum,
          currency,
          network,
          cryptoPrice,
        }),
      });

      const createData = await createResponse.json();

      if (!createData.success) {
        throw new Error(createData.message || "Failed to create withdrawal");
      }

      // Store locally
      createWithdrawalLocal({
        walletAddress,
        destinationAddress,
        amount: amountNum,
        cryptoAmount: withdrawal.cryptoAmount,
        currency,
        network,
      });

      // Step 2: Process the withdrawal (send crypto)
      const processResponse = await fetch("/api/withdrawal/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          withdrawalId: createData.data.id,
          walletAddress,
        }),
      });

      const processData = await processResponse.json();

      if (!processData.success) {
        // Check if it was refunded
        if (processData.refunded) {
          throw new Error(`${processData.message}. Your balance has been refunded.`);
        }
        throw new Error(processData.message || "Failed to process withdrawal");
      }

      // Success!
      setWithdrawalResult({
        txSignature: processData.data.txSignature,
        explorer: processData.data.explorer,
      });
      setStep("complete");
      onSuccess(amountNum);
      toast.success("Withdrawal sent successfully!");

    } catch (error: any) {
      console.error("Withdrawal error:", error);
      setWithdrawalResult({ error: error.message });
      setStep("failed");
      toast.error(error.message || "Withdrawal failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on step
  const renderStep = () => {
    switch (step) {
      case "select":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Withdraw Crypto</h3>
            <p className="text-gray-400 text-sm mb-4">
              Withdraw to your personal wallet. Sent automatically.
            </p>

            {/* Balance Display */}
            <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Available Balance</span>
                <span className="text-xl font-bold text-trench-accent">${userBalance.toFixed(2)}</span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min={minAmount}
                  max={userBalance}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-20 py-3 rounded-xl bg-trench-card border border-trench-border focus:border-trench-accent focus:outline-none text-white"
                  placeholder={minAmount.toString()}
                />
                <button
                  onClick={handleMaxAmount}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-trench-accent/20 text-trench-accent text-sm font-medium hover:bg-trench-accent/30 transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum: ${minAmount}</p>
            </div>

            {/* Currency Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Receive Currency</label>
              <div className="grid grid-cols-3 gap-2">
                {(["SOL", "USDT", "ETH"] as WithdrawalCurrency[]).map((cur) => (
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
                <label className="block text-sm text-gray-400 mb-2">Network</label>
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
                    <div className="text-xs text-gray-400">Low fees</div>
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

            {/* Destination Address */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Destination Address ({network === "solana" ? "Solana" : "Ethereum"})
              </label>
              <input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-trench-card border focus:outline-none text-white font-mono text-sm ${
                  destinationAddress && !addressValid
                    ? "border-red-500 focus:border-red-500"
                    : "border-trench-border focus:border-trench-accent"
                }`}
                placeholder={network === "solana" ? "Your Solana wallet address" : "0x..."}
              />
              {destinationAddress && !addressValid && (
                <p className="text-xs text-red-400 mt-1">Invalid {network === "solana" ? "Solana" : "Ethereum"} address</p>
              )}
            </div>

            {/* Fee Breakdown */}
            {amountNum > 0 && (
              <div className="bg-trench-black/50 rounded-xl p-4 mb-6 border border-trench-border">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Withdrawal amount</span>
                  <span className="text-white">${amountNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Fee ({(WITHDRAWAL_FEES[currency] * 100).toFixed(0)}%)</span>
                  <span className="text-red-400">-${withdrawal.feeUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Network fee</span>
                  <span className="text-red-400">-${withdrawal.networkFeeUsd.toFixed(2)}</span>
                </div>
                <div className="border-t border-trench-border my-2" />
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-300">You receive</span>
                  <span className="text-trench-cyan">
                    {withdrawal.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}
                  </span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  ≈ ${withdrawal.netAmountUsd.toFixed(2)}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitWithdrawal}
                disabled={!isValidAmount || !addressValid}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </>
        );

      case "confirm":
        return (
          <>
            <h3 className="text-xl font-bold mb-2">Confirm Withdrawal</h3>
            <p className="text-gray-400 text-sm mb-6">
              Please review the details before confirming.
            </p>

            {/* Summary */}
            <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Sending</span>
                <span className="text-white font-semibold">
                  {withdrawal.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Network</span>
                <span className="text-white">{network === "solana" ? "Solana" : "Ethereum"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">To</span>
                <span className="text-white font-mono text-xs">
                  {destinationAddress.slice(0, 8)}...{destinationAddress.slice(-8)}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-6">
              <p className="text-sm text-yellow-400">
                ⚠️ This action is irreversible. Make sure the address is correct.
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
                onClick={handleConfirmWithdrawal}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Confirm & Send
              </button>
            </div>
          </>
        );

      case "processing":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-trench-accent border-t-transparent animate-spin" />
            <h3 className="text-xl font-bold mb-2">Processing Withdrawal</h3>
            <p className="text-gray-400 text-sm">
              Sending {withdrawal.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency}...
            </p>
            <p className="text-gray-500 text-xs mt-4">
              This may take a moment. Do not close this window.
            </p>
          </div>
        );

      case "complete":
        return (
          <>
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Withdrawal Sent!</h3>
              <p className="text-gray-400 mb-4">
                {withdrawal.cryptoAmount.toFixed(currency === "USDT" ? 2 : 6)} {currency} is on its way.
              </p>
              
              {withdrawalResult?.explorer && (
                <a
                  href={withdrawalResult.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-trench-cyan hover:underline"
                >
                  View on {network === "solana" ? "Solscan" : "Etherscan"} →
                </a>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </>
        );

      case "failed":
        return (
          <>
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">Withdrawal Failed</h3>
              <p className="text-gray-400 mb-4">
                {withdrawalResult?.error || "An error occurred while processing your withdrawal."}
              </p>
            </div>

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
                Try Again
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
        onClick={step !== "processing" ? onClose : undefined}
      />
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-trench-card border border-trench-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {renderStep()}
      </div>
    </div>
  );
}

