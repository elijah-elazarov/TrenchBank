"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { VirtualCard } from "@/components/VirtualCard";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import {
  kripicardClient,
  getStoredCards,
  storeCard,
  updateStoredCard,
  StoredCard,
  CardDetails,
  CardTransaction,
} from "@/lib/kripicard";
import { depositClient } from "@/lib/deposit";
import { CryptoDepositModal } from "@/components/CryptoDepositModal";
import { WithdrawalModal } from "@/components/WithdrawalModal";
import { getPendingCryptoDeposits, CryptoDepositRequest } from "@/lib/crypto-deposit";

// Bank BIN is now configured via KRIPICARD_BANK_BIN environment variable

// KripiCard Fee Structure
const CARD_FEE = 4.00; // Flat $4 card fee (new cards only)
const SERVICE_FEE_PERCENT = 0.02; // 2%
const SERVICE_FEE_FLAT = 1.00; // + $1

function calculateCardFees(amount: number) {
  const serviceFee = (amount * SERVICE_FEE_PERCENT) + SERVICE_FEE_FLAT;
  const totalFees = CARD_FEE + serviceFee;
  const totalCost = amount + totalFees;
  return {
    cardAmount: amount,
    cardFee: CARD_FEE,
    serviceFee,
    totalFees,
    totalCost,
  };
}

// Funding fees (no card fee, just service fee)
function calculateFundingFees(amount: number) {
  const serviceFee = (amount * SERVICE_FEE_PERCENT) + SERVICE_FEE_FLAT;
  const totalCost = amount + serviceFee;
  return {
    fundAmount: amount,
    serviceFee,
    totalCost,
  };
}

export default function CardsPage() {
  const { publicKey, connected } = useWallet();
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<StoredCard | null>(null);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [createAmount, setCreateAmount] = useState("25");
  const [fundAmount, setFundAmount] = useState("25");
  const [userBalance, setUserBalance] = useState(0);
  const [pendingDeposits, setPendingDeposits] = useState<CryptoDepositRequest[]>([]);

  // Load stored cards and balance on mount
  useEffect(() => {
    if (publicKey) {
      const walletAddress = publicKey.toString();
      
      // Fetch cards from server storage (persists across browsers)
      const loadCards = async () => {
        try {
          const response = await fetch(`/api/cards/store?walletAddress=${encodeURIComponent(walletAddress)}`);
          const data = await response.json();
          
          if (data.success && data.cards && data.cards.length > 0) {
            // Use server-side cards
            setCards(data.cards);
            if (data.cards.length > 0 && !selectedCard) {
              setSelectedCard(data.cards[0]);
            }
          } else {
            // Fallback to localStorage
            const storedCards = getStoredCards(walletAddress);
            setCards(storedCards);
            if (storedCards.length > 0 && !selectedCard) {
              setSelectedCard(storedCards[0]);
            }
          }
        } catch {
          // Fallback to localStorage on error
          const storedCards = getStoredCards(walletAddress);
          setCards(storedCards);
          if (storedCards.length > 0 && !selectedCard) {
            setSelectedCard(storedCards[0]);
          }
        }
      };
      
      loadCards();
      // Load pending crypto deposits
      setPendingDeposits(getPendingCryptoDeposits(walletAddress));
      // Load balance
      fetchBalance();
    } else {
      setCards([]);
      setSelectedCard(null);
      setCardDetails(null);
      setUserBalance(0);
      setPendingDeposits([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  // Fetch user balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const response = await depositClient.getBalance(publicKey.toString());
      if (response.success && response.data) {
        setUserBalance(response.data.balance);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  }, [publicKey]);

  // Refresh pending deposits list
  const refreshPendingDeposits = useCallback(() => {
    if (publicKey) {
      setPendingDeposits(getPendingCryptoDeposits(publicKey.toString()));
    }
  }, [publicKey]);

  // Fetch card details when selected card changes
  const fetchCardDetails = useCallback(async () => {
    if (!selectedCard) return;

    setIsLoading(true);
    try {
      const response = await kripicardClient.getCardDetails(selectedCard.cardId);
      if (response.success && response.data) {
        setCardDetails(response.data.details);
        setTransactions(response.data.Transactions || []);
        updateStoredCard(selectedCard.cardId, {
          balance: response.data.details.balance,
          status: response.data.details.status,
          lastFour: response.data.details.card_number?.slice(-4),
        });
      }
    } catch (error) {
      console.error("Failed to fetch card details:", error);
      // Don't show toast for every fetch failure
    } finally {
      setIsLoading(false);
    }
  }, [selectedCard]);

  useEffect(() => {
    if (selectedCard) {
      fetchCardDetails();
    }
  }, [selectedCard, fetchCardDetails]);

  // Create a new card
  const handleCreateCard = async () => {
    if (!publicKey) return;

    const amount = parseFloat(createAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error("Minimum card amount is $10");
      return;
    }

    // Calculate total cost with fees
    const fees = calculateCardFees(amount);

    // Check if user has sufficient balance for total cost
    if (userBalance < fees.totalCost) {
      toast.error(`Insufficient balance. You have $${userBalance.toFixed(2)}, need $${fees.totalCost.toFixed(2)} (including fees)`);
      return;
    }

    setIsLoading(true);
    try {
      // First, debit the user's balance (total cost including fees)
      const debitResponse = await depositClient.updateBalance({
        walletAddress: publicKey.toString(),
        action: 'debit',
        amount: fees.totalCost,
      });

      if (!debitResponse.success) {
        toast.error(debitResponse.message || "Insufficient balance");
        return;
      }

      // Now create the card via KripiCard
      const response = await kripicardClient.createCard({
        amount,
      });

      if (response.success && response.card_id) {
        const newCard: StoredCard = {
          id: crypto.randomUUID(),
          cardId: response.card_id,
          walletAddress: publicKey.toString(),
          createdAt: new Date().toISOString(),
          status: "active",
          balance: amount,
        };

        storeCard(newCard);
        setCards((prev) => [...prev, newCard]);
        setSelectedCard(newCard);
        setShowCreateModal(false);
        setUserBalance(debitResponse.data?.balance ?? userBalance - fees.totalCost);
        toast.success(`Card created with $${amount} balance!`);
      } else {
        // Card creation failed, refund the total cost
        await depositClient.updateBalance({
          walletAddress: publicKey.toString(),
          action: 'credit',
          amount: fees.totalCost,
        });
        fetchBalance();
        
        // Track as pending refund from KripiCard (they may send money back to merchant wallet)
        try {
          await fetch('/api/kripicard/track-refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: publicKey.toString(),
              amount: fees.totalCost,
              reason: response.message || 'Card creation failed',
            }),
          });
        } catch (e) {
          console.error('Failed to track pending refund:', e);
        }
        
        toast.error(response.message || "Failed to create card");
      }
    } catch (error) {
      // Refund on error
      await depositClient.updateBalance({
        walletAddress: publicKey.toString(),
        action: 'credit',
        amount: fees.totalCost,
      });
      fetchBalance();
      
      // Track as pending refund from KripiCard
      try {
        await fetch('/api/kripicard/track-refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: publicKey.toString(),
            amount: fees.totalCost,
            reason: error instanceof Error ? error.message : 'Card creation error',
          }),
        });
      } catch (e) {
        console.error('Failed to track pending refund:', e);
      }
      
      toast.error(error instanceof Error ? error.message : "Failed to create card");
    } finally {
      setIsLoading(false);
    }
  };

  // Fund existing card
  const handleFundCard = async () => {
    if (!selectedCard || !publicKey) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error("Minimum funding amount is $10");
      return;
    }

    // Calculate total cost with fees
    const fees = calculateFundingFees(amount);

    // Check if user has sufficient balance for total cost
    if (userBalance < fees.totalCost) {
      toast.error(`Insufficient balance. You have $${userBalance.toFixed(2)}, need $${fees.totalCost.toFixed(2)} (including fees)`);
      return;
    }

    setIsLoading(true);
    try {
      // First, debit the user's balance (total cost including fees)
      const debitResponse = await depositClient.updateBalance({
        walletAddress: publicKey.toString(),
        action: 'debit',
        amount: fees.totalCost,
      });

      if (!debitResponse.success) {
        toast.error(debitResponse.message || "Insufficient balance");
        return;
      }

      // Now fund the card via KripiCard
      const response = await kripicardClient.fundCard({
        cardId: selectedCard.cardId,
        amount,
      });

      if (response.success) {
        toast.success(`Added $${amount} to card!`);
        setShowFundModal(false);
        setUserBalance(debitResponse.data?.balance ?? userBalance - fees.totalCost);
        fetchCardDetails();
      } else {
        // Funding failed, refund the total cost
        await depositClient.updateBalance({
          walletAddress: publicKey.toString(),
          action: 'credit',
          amount: fees.totalCost,
        });
        fetchBalance();
        toast.error(response.message || "Failed to fund card");
      }
    } catch (error) {
      // Refund on error - need to get fees again since they might be out of scope
      const refundFees = calculateFundingFees(parseFloat(fundAmount) || 0);
      await depositClient.updateBalance({
        walletAddress: publicKey.toString(),
        action: 'credit',
        amount: refundFees.totalCost,
      });
      fetchBalance();
      toast.error(error instanceof Error ? error.message : "Failed to fund card");
    } finally {
      setIsLoading(false);
    }
  };

  // Freeze card
  const handleFreezeCard = async () => {
    if (!selectedCard) return;

    setIsLoading(true);
    try {
      const response = await kripicardClient.freezeUnfreeze({
        cardId: selectedCard.cardId,
        action: "freeze",
      });

      if (response.success) {
        toast.success("Card frozen");
        updateStoredCard(selectedCard.cardId, { status: "frozen" });
        setCards((prev) =>
          prev.map((c) =>
            c.cardId === selectedCard.cardId ? { ...c, status: "frozen" as const } : c
          )
        );
        setCardDetails((prev) => (prev ? { ...prev, status: "frozen" } : null));
      } else {
        toast.error(response.message || "Failed to freeze card");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to freeze card");
    } finally {
      setIsLoading(false);
    }
  };

  // Unfreeze card
  const handleUnfreezeCard = async () => {
    if (!selectedCard) return;

    setIsLoading(true);
    try {
      const response = await kripicardClient.freezeUnfreeze({
        cardId: selectedCard.cardId,
        action: "unfreeze",
      });

      if (response.success) {
        toast.success("Card unfrozen");
        updateStoredCard(selectedCard.cardId, { status: "active" });
        setCards((prev) =>
          prev.map((c) =>
            c.cardId === selectedCard.cardId ? { ...c, status: "active" as const } : c
          )
        );
        setCardDetails((prev) => (prev ? { ...prev, status: "active" } : null));
      } else {
        toast.error(response.message || "Failed to unfreeze card");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfreeze card");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful deposit
  const handleDepositSuccess = (amount: number) => {
    setUserBalance(prev => prev + amount);
    refreshPendingDeposits();
    // Don't auto-close modal - let user see the "Complete" screen
  };

  // When deposit modal closes, refresh balance from server
  const handleDepositModalClose = useCallback(() => {
    setShowDepositModal(false);
    // Fetch latest balance from server to ensure consistency
    fetchBalance();
  }, [fetchBalance]);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background */}
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
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-trench-cyan/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-trench-accent/5 rounded-full blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-trench-cyan/10 border border-trench-cyan/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-trench-cyan animate-pulse" />
              <span className="text-sm text-trench-cyan font-medium">
                Powered by Kripicard
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              <span className="text-white">Virtual </span>
              <span className="bg-gradient-to-r from-trench-cyan to-trench-accent bg-clip-text text-transparent">
                Debit Cards
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Spend your crypto anywhere. Create virtual cards instantly and use them
              worldwide.
            </p>
          </div>

          {connected ? (
            <div className="max-w-4xl mx-auto">
              {/* Balance Card */}
              <div className="gradient-border p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-gray-400">Available Balance</p>
                      <button
                        onClick={fetchBalance}
                        disabled={isLoading}
                        className="p-1 rounded-full hover:bg-trench-accent/10 transition-colors disabled:opacity-50"
                        title="Refresh balance"
                      >
                        <svg
                          className={`w-4 h-4 text-gray-400 ${isLoading ? "animate-spin" : ""}`}
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
                    <p className="text-3xl font-bold text-white">
                      ${userBalance.toFixed(2)}
                      <span className="text-sm text-gray-400 ml-2">USD</span>
                    </p>
                    {pendingDeposits.length > 0 && (
                      <button
                        onClick={() => setShowDepositModal(true)}
                        className="text-xs text-yellow-400 mt-1 flex items-center gap-1 hover:text-yellow-300 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        {pendingDeposits.length} pending deposit{pendingDeposits.length > 1 ? 's' : ''} - Click to verify
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDepositModal(true)}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Deposit
                    </button>
                    <button
                      onClick={() => setShowWithdrawModal(true)}
                      disabled={userBalance <= 0}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card List */}
                <div className="lg:col-span-1">
                  <div className="gradient-border p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Your Cards</h2>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="p-2 rounded-lg bg-trench-accent/10 hover:bg-trench-accent/20 transition-colors"
                        title={userBalance < 15.20 ? "Deposit funds first (min ~$15.20 for $10 card)" : "Create new card"}
                      >
                        <svg
                          className="w-5 h-5 text-trench-accent"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    </div>

                    {cards.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-trench-card flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-400 mb-4">No cards yet</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity"
                        >
                          Create Your First Card
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cards.map((card) => (
                          <button
                            key={card.id}
                            onClick={() => setSelectedCard(card)}
                            className={`w-full p-3 rounded-xl border transition-all text-left ${
                              selectedCard?.id === card.id
                                ? "bg-trench-accent/10 border-trench-accent/50"
                                : "bg-trench-card/50 border-trench-border hover:border-trench-accent/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-7 rounded-md ${
                                    card.status === "frozen"
                                      ? "bg-gradient-to-br from-slate-600 to-slate-700"
                                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                  }`}
                                />
                                <div>
                                  <p className="text-white font-medium text-sm">
                                    •••• {card.lastFour || "••••"}
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    {card.status === "frozen" ? "Frozen" : "Active"}
                                  </p>
                                </div>
                              </div>
                              {card.balance !== undefined && (
                                <p className="text-trench-accent font-semibold">
                                  ${card.balance.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Card Display */}
                <div className="lg:col-span-2">
                  {selectedCard ? (
                    <div className="gradient-border p-6">
                      <VirtualCard
                        cardId={selectedCard.cardId}
                        details={cardDetails || undefined}
                        transactions={transactions}
                        lastFour={selectedCard.lastFour}
                        storedBalance={selectedCard.balance}
                        storedStatus={selectedCard.status}
                        storedExpiry={selectedCard.expiry}
                        onFund={() => setShowFundModal(true)}
                        onFreeze={handleFreezeCard}
                        onUnfreeze={handleUnfreezeCard}
                        onRefresh={fetchCardDetails}
                        isLoading={isLoading}
                      />
                    </div>
                  ) : (
                    <div className="gradient-border p-12 text-center">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-trench-card flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Select a Card</h3>
                      <p className="text-gray-400">
                        Choose a card from the list or create a new one
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FeatureCard
                  icon="🌍"
                  title="Global Acceptance"
                  description="Use your virtual card at millions of merchants worldwide, online and in-store."
                />
                <FeatureCard
                  icon="⚡"
                  title="Instant Issuance"
                  description="Get your card in seconds. No waiting, no paperwork, no hassle."
                />
                <FeatureCard
                  icon="🔒"
                  title="Full Control"
                  description="Freeze, unfreeze, and manage your card anytime from your wallet."
                />
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto">
              <div className="gradient-border p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-trench-cyan/10 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-trench-cyan"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
                <p className="text-gray-400 mb-6">
                  Connect your Solana wallet to create and manage virtual debit cards.
                </p>
                <div className="text-sm text-gray-500">
                  Supports Phantom, Solflare, Coinbase, Ledger & more
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Card Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <h3 className="text-xl font-bold mb-4">Create New Card</h3>
          <p className="text-gray-400 mb-2">
            Enter the initial amount to fund your new virtual debit card.
          </p>
          <p className="text-sm text-trench-cyan mb-6">
            Available balance: ${userBalance.toFixed(2)}
          </p>
          {(() => {
            const fees = calculateCardFees(parseFloat(createAmount) || 0);
            const canAfford = userBalance >= fees.totalCost;
            const validAmount = (parseFloat(createAmount) || 0) >= 10;
            
            return (
              <>
                {!canAfford && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                    <p className="text-yellow-400 text-sm">
                      Insufficient balance. You need ${fees.totalCost.toFixed(2)} (including fees).
                    </p>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowDepositModal(true);
                      }}
                      className="mt-2 text-sm text-trench-cyan hover:underline"
                    >
                      Deposit Funds →
                    </button>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Card Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="10"
                      max={Math.max(10, userBalance - 5.20)}
                      step="1"
                      value={createAmount}
                      onChange={(e) => setCreateAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-trench-card border border-trench-border focus:border-trench-accent focus:outline-none text-white"
                      placeholder="10"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum: $10</p>
                </div>

                {/* Fee Breakdown */}
                {validAmount && (
                  <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Card Amount</span>
                      <span className="text-trench-cyan">${fees.cardAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Card Fee</span>
                      <span className="text-gray-300">${fees.cardFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Service Fee (2% + $1)</span>
                      <span className="text-gray-300">${fees.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-trench-border my-2" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Total Cost</span>
                      <span className="text-yellow-400">${fees.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCard}
                    disabled={isLoading || !canAfford || !validAmount}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isLoading ? "Creating..." : "Create Card"}
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {/* Fund Card Modal */}
      {showFundModal && (
        <Modal onClose={() => setShowFundModal(false)}>
          <h3 className="text-xl font-bold mb-4">Add Funds to Card</h3>
          <p className="text-gray-400 mb-2">Enter the amount to add to your card.</p>
          <p className="text-sm text-trench-cyan mb-4">
            Available balance: ${userBalance.toFixed(2)}
          </p>
          {(() => {
            const fees = calculateFundingFees(parseFloat(fundAmount) || 0);
            const canAfford = userBalance >= fees.totalCost;
            const validAmount = (parseFloat(fundAmount) || 0) >= 10;
            
            return (
              <>
                {!canAfford && validAmount && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
                    <p className="text-yellow-400 text-sm">
                      Insufficient balance. You need ${fees.totalCost.toFixed(2)} (including fees).
                    </p>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Amount to Add (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="10"
                      max={Math.max(10, userBalance - 1.20)}
                      step="1"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-trench-card border border-trench-border focus:border-trench-accent focus:outline-none text-white"
                      placeholder="10"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum: $10</p>
                </div>

                {/* Fee Breakdown */}
                {validAmount && (
                  <div className="bg-trench-black/50 rounded-xl p-4 mb-4 border border-trench-border">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Amount to Card</span>
                      <span className="text-trench-cyan">${fees.fundAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Service Fee (2% + $1)</span>
                      <span className="text-gray-300">${fees.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-trench-border my-2" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Total Cost</span>
                      <span className="text-yellow-400">${fees.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFundModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-trench-accent/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFundCard}
                    disabled={isLoading || !canAfford || !validAmount}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isLoading ? "Processing..." : "Add Funds"}
                  </button>
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {/* Crypto Deposit Modal */}
      {showDepositModal && publicKey && (
        <CryptoDepositModal
          walletAddress={publicKey.toString()}
          onClose={handleDepositModalClose}
          onSuccess={handleDepositSuccess}
        />
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && publicKey && (
        <WithdrawalModal
          walletAddress={publicKey.toString()}
          userBalance={userBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={(amount) => {
            setUserBalance((prev) => prev - amount);
            toast.success(`Withdrawal of $${amount.toFixed(2)} processed!`);
          }}
        />
      )}
    </main>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-trench-card border border-trench-border shadow-2xl">
        {children}
      </div>
    </div>
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
    <div className="p-6 rounded-2xl bg-trench-card/50 border border-trench-border hover:border-trench-cyan/30 transition-all duration-300 group">
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

