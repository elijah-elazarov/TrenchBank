// Automated Withdrawal System
// Sends SOL, USDT (Solana SPL), and ETH to user wallets

export type WithdrawalNetwork = 'solana' | 'ethereum';
export type WithdrawalCurrency = 'SOL' | 'USDT' | 'ETH';

export interface WithdrawalRequest {
  id: string;
  walletAddress: string; // User's TrenchBank wallet (for tracking)
  destinationAddress: string; // Where to send the crypto
  amount: number; // Amount in USD
  cryptoAmount: number; // Amount in crypto to send
  currency: WithdrawalCurrency;
  network: WithdrawalNetwork;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txSignature?: string; // Transaction signature once sent
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

// Withdrawal fees (percentage)
export const WITHDRAWAL_FEES: Record<WithdrawalCurrency, number> = {
  SOL: 0.01, // 1% fee
  USDT: 0.01, // 1% fee
  ETH: 0.02, // 2% fee (higher gas costs)
};

// Minimum withdrawal amounts in USD
export const MIN_WITHDRAWAL: Record<WithdrawalCurrency, number> = {
  SOL: 10,
  USDT: 10,
  ETH: 25, // Higher due to gas costs
};

// Network fees (estimated, in USD) - covers gas
export const NETWORK_FEES: Record<WithdrawalCurrency, number> = {
  SOL: 0.01, // ~0.01 USD for Solana tx
  USDT: 0.02, // SPL token transfer
  ETH: 5, // ETH gas is expensive
};

// Local storage key
const WITHDRAWALS_KEY = 'trenchbank_withdrawals';

// Get all withdrawals from storage
export function getWithdrawals(): WithdrawalRequest[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(WITHDRAWALS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save withdrawals to storage
function saveWithdrawals(withdrawals: WithdrawalRequest[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(withdrawals));
}

// Get user's withdrawals
export function getUserWithdrawals(walletAddress: string): WithdrawalRequest[] {
  return getWithdrawals()
    .filter(w => w.walletAddress === walletAddress)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get pending withdrawals
export function getPendingWithdrawals(walletAddress: string): WithdrawalRequest[] {
  return getUserWithdrawals(walletAddress).filter(w => w.status === 'pending' || w.status === 'processing');
}

// Create a withdrawal request locally
export function createWithdrawalLocal(params: {
  walletAddress: string;
  destinationAddress: string;
  amount: number;
  cryptoAmount: number;
  currency: WithdrawalCurrency;
  network: WithdrawalNetwork;
}): WithdrawalRequest {
  const withdrawals = getWithdrawals();
  
  const withdrawal: WithdrawalRequest = {
    id: crypto.randomUUID(),
    ...params,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  withdrawals.push(withdrawal);
  saveWithdrawals(withdrawals);
  
  return withdrawal;
}

// Update withdrawal status locally
export function updateWithdrawalLocal(withdrawalId: string, updates: Partial<WithdrawalRequest>): WithdrawalRequest | null {
  const withdrawals = getWithdrawals();
  const index = withdrawals.findIndex(w => w.id === withdrawalId);
  
  if (index === -1) return null;
  
  withdrawals[index] = { ...withdrawals[index], ...updates };
  saveWithdrawals(withdrawals);
  
  return withdrawals[index];
}

// Calculate withdrawal details
export function calculateWithdrawal(
  amountUsd: number,
  currency: WithdrawalCurrency,
  cryptoPrice: number
): {
  grossAmount: number; // USD before fees
  feePercent: number;
  feeUsd: number;
  networkFeeUsd: number;
  netAmountUsd: number; // USD after fees
  cryptoAmount: number; // Crypto to receive
} {
  const feePercent = WITHDRAWAL_FEES[currency];
  const feeUsd = amountUsd * feePercent;
  const networkFeeUsd = NETWORK_FEES[currency];
  const netAmountUsd = amountUsd - feeUsd - networkFeeUsd;
  const cryptoAmount = netAmountUsd / cryptoPrice;
  
  return {
    grossAmount: amountUsd,
    feePercent,
    feeUsd,
    networkFeeUsd,
    netAmountUsd: Math.max(0, netAmountUsd),
    cryptoAmount: Math.max(0, cryptoAmount),
  };
}

// Validate destination address format
export function isValidAddress(address: string, network: WithdrawalNetwork): boolean {
  if (network === 'solana') {
    // Solana addresses are base58 encoded, 32-44 chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } else {
    // Ethereum addresses are 0x followed by 40 hex chars
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

