"use client";

import { useState } from "react";
import { CardDetails, CardTransaction } from "@/lib/kripicard";

interface VirtualCardProps {
  cardId: string;
  details?: CardDetails;
  transactions?: CardTransaction[];
  lastFour?: string; // Fallback last 4 digits from stored card
  storedBalance?: number; // Fallback balance from stored card
  storedStatus?: 'active' | 'frozen' | 'inactive'; // Fallback status
  storedExpiry?: string; // Fallback expiry from stored card (format: "MM/YY")
  onFund: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function VirtualCard({
  cardId,
  details,
  transactions = [],
  lastFour,
  storedBalance,
  storedStatus,
  storedExpiry,
  onFund,
  onFreeze,
  onUnfreeze,
  onRefresh,
  isLoading,
}: VirtualCardProps) {
  const [showFullNumber, setShowFullNumber] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Always show last 4 digits, mask the rest
  const formatCardNumber = (number?: string) => {
    // Use the full card number if available
    if (number && number.length >= 4) {
      const last4 = number.slice(-4);
      
      if (showFullNumber) {
        // Show full number formatted
        return number.replace(/(.{4})/g, "$1 ").trim();
      }
      
      // Show last 4 digits
      return `•••• •••• •••• ${last4}`;
    }
    
    // Fallback to stored lastFour if no full number
    if (lastFour && lastFour.length === 4) {
      return `•••• •••• •••• ${lastFour}`;
    }
    
    return "•••• •••• •••• ••••";
  };

  // Check if expiry data is available (from API or stored)
  const hasExpiryData = () => {
    // Check API details first
    if (details) {
      const month = details.expiry_month;
      const year = details.expiry_year;
      const monthInvalid = !month || month === "" || month === "undefined" || month === "null";
      const yearInvalid = !year || year === "" || year === "undefined" || year === "null";
      if (!monthInvalid && !yearInvalid) return true;
    }
    // Fallback to stored expiry
    if (storedExpiry && storedExpiry !== "" && storedExpiry !== "undefined" && storedExpiry !== "null") {
      return true;
    }
    return false;
  };

  // Format expiry date - hidden by default, toggle to show
  // Works same as CVV: shows dots if no data OR if hidden
  const formatExpiry = () => {
    if (!hasExpiryData()) return "••/••"; // No data = always dots
    if (!showExpiry) return "••/••";      // Has data but hidden = dots
    
    // Try API data first
    if (details) {
      const month = details.expiry_month;
      const year = details.expiry_year;
      const monthValid = month && month !== "" && month !== "undefined" && month !== "null";
      const yearValid = year && year !== "" && year !== "undefined" && year !== "null";
      
      if (monthValid && yearValid) {
        const formattedMonth = String(month).padStart(2, "0");
        const yearStr = String(year);
        const formattedYear = yearStr.length === 4 ? yearStr.slice(-2) : yearStr.padStart(2, "0");
        return `${formattedMonth}/${formattedYear}`;
      }
    }
    
    // Fallback to stored expiry (already in MM/YY format)
    if (storedExpiry) {
      return storedExpiry;
    }
    
    return "••/••";
  };

  // Format CVV - hidden by default, toggle to show
  const formatCVV = () => {
    if (!details?.cvv) return "•••"; // No data = always dots
    if (!showCVV) return "•••";      // Has data but hidden = dots
    return details.cvv;
  };

  // Use details or fallback to stored values
  const isFrozen = (details?.status || storedStatus) === "frozen";
  const cardNumberExists = (details?.card_number && details.card_number.length >= 4) || (lastFour && lastFour.length === 4);
  // Use API balance if available and > 0, otherwise fall back to stored balance
  // This prevents showing $0.00 when API returns 0 but we have a known stored balance
  const cardBalance = (details?.balance !== undefined && details.balance > 0) 
    ? details.balance 
    : (storedBalance ?? details?.balance ?? 0);

  return (
    <div className="space-y-4">
      {/* Card Visual */}
      <div
        className={`relative rounded-2xl p-6 h-52 overflow-hidden transition-all duration-500 ${
          isFrozen
            ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
            : "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700"
        }`}
        style={{
          boxShadow: isFrozen
            ? "0 25px 50px -12px rgba(100, 116, 139, 0.4)"
            : "0 25px 50px -12px rgba(16, 185, 129, 0.4)",
        }}
      >
        {/* Card Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Frozen Overlay */}
        {isFrozen && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-600">
              <svg
                className="w-5 h-5 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
                />
              </svg>
              <span className="text-sm font-medium text-white">Card Frozen</span>
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className="relative z-0 flex flex-col h-full justify-between">
          {/* Top Row */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                KryptCash
              </p>
              <p className="text-white/80 text-xs mt-1">Virtual Debit</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Chip */}
              <div className="w-10 h-8 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg">
                <div className="w-full h-full grid grid-cols-3 gap-px p-1">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-amber-600/30 rounded-sm" />
                  ))}
                </div>
              </div>
              {/* Contactless */}
              <svg
                className="w-6 h-6 text-white/70"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
          </div>

          {/* Card Number */}
          <div className="flex items-center gap-3">
            <div
              className={`group flex-1 ${cardNumberExists && showFullNumber ? 'cursor-pointer' : ''}`}
              onClick={() =>
                details?.card_number &&
                showFullNumber &&
                copyToClipboard(details.card_number, "number")
              }
            >
              <p className="text-white text-xl md:text-2xl font-mono tracking-widest select-none">
                {formatCardNumber(details?.card_number)}
              </p>
              {showFullNumber && details?.card_number && (
                <p className="text-white/50 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {copiedField === "number" ? "Copied!" : "Click to copy"}
                </p>
              )}
            </div>
            {/* Card Number Eye Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullNumber(!showFullNumber);
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title={showFullNumber ? "Hide card number" : "Show full card number"}
            >
              {showFullNumber ? (
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Bottom Row */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                Cardholder
              </p>
              <p className="text-white font-medium tracking-wide">
                KRYPTCASH USER
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                Expires
              </p>
              <div className="flex items-center gap-1">
                <p className="text-white font-mono">
                  {formatExpiry()}
                </p>
                {/* Expiry Eye Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExpiry(!showExpiry);
                  }}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                  title={showExpiry ? "Hide expiry" : "Show expiry"}
                >
                  {showExpiry ? (
                    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                CVV
              </p>
              <div className="flex items-center gap-1">
                <p
                  className={`text-white font-mono ${showCVV && details?.cvv ? 'cursor-pointer' : ''}`}
                  onClick={() =>
                    details?.cvv &&
                    showCVV &&
                    copyToClipboard(details.cvv, "cvv")
                  }
                >
                  {formatCVV()}
                </p>
                {/* CVV Eye Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCVV(!showCVV);
                  }}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                  title={showCVV ? "Hide CVV" : "Show CVV"}
                >
                  {showCVV ? (
                    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
                {copiedField === "cvv" && (
                  <span className="text-xs text-white/50">Copied!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Balance - Inline with actions */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">
              Card Balance
            </p>
            <p className="text-2xl font-bold text-white">
              ${cardBalance.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-trench-card border border-trench-border hover:border-trench-accent/50 transition-colors disabled:opacity-50"
            title="Refresh card details"
          >
            <svg
              className={`w-5 h-5 text-gray-400 ${isLoading ? "animate-spin" : ""}`}
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

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onFund}
          disabled={isFrozen}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-trench-accent to-trench-cyan text-trench-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add Funds
        </button>
        {isFrozen ? (
          <button
            onClick={onUnfreeze}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-trench-card border border-cyan-500/50 text-cyan-400 font-semibold hover:bg-cyan-500/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
              />
            </svg>
            Unfreeze Card
          </button>
        ) : (
          <button
            onClick={onFreeze}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-trench-card border border-trench-border text-gray-300 font-semibold hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            Freeze Card
          </button>
        )}
      </div>

      {/* Transactions */}
      {transactions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 text-white">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl bg-trench-card/50 border border-trench-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === "funding"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : tx.type === "refund"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {tx.type === "funding" ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 11l5-5m0 0l5 5m-5-5v12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 13l-5 5m0 0l-5-5m5 5V6"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {tx.merchant || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      tx.type === "funding" || tx.type === "refund"
                        ? "text-emerald-400"
                        : "text-white"
                    }`}
                  >
                    {tx.type === "funding" || tx.type === "refund" ? "+" : "-"}$
                    {tx.amount.toFixed(2)}
                  </p>
                  <p
                    className={`text-xs ${
                      tx.status === "completed"
                        ? "text-emerald-400"
                        : tx.status === "pending"
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card ID */}
      <p className="text-center text-gray-500 text-xs mt-4">Card ID: {cardId}</p>
    </div>
  );
}
