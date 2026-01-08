// Direct Crypto Deposit System
// Accepts SOL, USDT (Solana SPL), and ETH payments

export type CryptoNetwork = 'solana' | 'ethereum';
export type CryptoCurrency = 'SOL' | 'USDT' | 'ETH';

export interface DepositAddress {
  network: CryptoNetwork;
  currency: CryptoCurrency;
  address: string;
  memo?: string; // For Solana, we use memo for reference
}

export interface CryptoDepositRequest {
  id: string;
  walletAddress: string; // User's TrenchBank wallet
  amount: number; // Gross amount in USD (what user sends)
  netAmount?: number; // Net amount in USD (what user receives after fees)
  cryptoAmount: number; // Amount in crypto (gross)
  currency: CryptoCurrency;
  network: CryptoNetwork;
  depositAddress: string;
  reference: string; // Unique reference for this deposit
  status: 'pending' | 'confirming' | 'completed' | 'expired' | 'failed';
  txSignature?: string; // Transaction signature once paid
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
}

// Crypto price estimates (in production, fetch from an API like CoinGecko)
export const CRYPTO_PRICES: Record<CryptoCurrency, number> = {
  SOL: 185, // ~$185 per SOL
  USDT: 1,  // $1 per USDT (stablecoin)
  ETH: 3200, // ~$3200 per ETH
};

// Network details
export const NETWORK_CONFIG: Record<CryptoNetwork, {
  name: string;
  explorer: string;
  currencies: CryptoCurrency[];
}> = {
  solana: {
    name: 'Solana',
    explorer: 'https://solscan.io/tx/',
    currencies: ['SOL', 'USDT'],
  },
  ethereum: {
    name: 'Ethereum',
    explorer: 'https://etherscan.io/tx/',
    currencies: ['ETH', 'USDT'],
  },
};

// Token addresses
export const TOKEN_ADDRESSES = {
  USDT_SOLANA: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT SPL token
  USDT_ETHEREUM: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT ERC-20
};

// Generate a unique reference code for deposits
export function generateDepositReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
  let result = 'TB-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Calculate crypto amount from USD
export function usdToCrypto(usdAmount: number, currency: CryptoCurrency): number {
  const price = CRYPTO_PRICES[currency];
  return Number((usdAmount / price).toFixed(currency === 'USDT' ? 2 : 6));
}

// Calculate USD amount from crypto
export function cryptoToUsd(cryptoAmount: number, currency: CryptoCurrency): number {
  const price = CRYPTO_PRICES[currency];
  return Number((cryptoAmount * price).toFixed(2));
}

// Local storage keys
const DEPOSITS_KEY = 'trenchbank_crypto_deposits';
const USED_TX_KEY = 'trenchbank_used_transactions';

// Get all deposits from storage
export function getCryptoDeposits(): CryptoDepositRequest[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEPOSITS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save deposits to storage
function saveDeposits(deposits: CryptoDepositRequest[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEPOSITS_KEY, JSON.stringify(deposits));
}

// Get user's deposits
export function getUserCryptoDeposits(walletAddress: string): CryptoDepositRequest[] {
  return getCryptoDeposits()
    .filter(d => d.walletAddress === walletAddress)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get pending deposits
export function getPendingCryptoDeposits(walletAddress: string): CryptoDepositRequest[] {
  return getUserCryptoDeposits(walletAddress).filter(d => d.status === 'pending' || d.status === 'confirming');
}

// Create a new deposit request
export function createCryptoDeposit(params: {
  walletAddress: string;
  amount: number;
  currency: CryptoCurrency;
  network: CryptoNetwork;
  depositAddress: string;
}): CryptoDepositRequest {
  const deposits = getCryptoDeposits();
  
  const deposit: CryptoDepositRequest = {
    id: crypto.randomUUID(),
    walletAddress: params.walletAddress,
    amount: params.amount,
    cryptoAmount: usdToCrypto(params.amount, params.currency),
    currency: params.currency,
    network: params.network,
    depositAddress: params.depositAddress,
    reference: generateDepositReference(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour expiry
  };
  
  deposits.push(deposit);
  saveDeposits(deposits);
  
  return deposit;
}

// Update deposit status
export function updateCryptoDeposit(depositId: string, updates: Partial<CryptoDepositRequest>): CryptoDepositRequest | null {
  const deposits = getCryptoDeposits();
  const index = deposits.findIndex(d => d.id === depositId);
  
  if (index === -1) return null;
  
  deposits[index] = { ...deposits[index], ...updates };
  saveDeposits(deposits);
  
  return deposits[index];
}

// Find deposit by reference
export function findDepositByReference(reference: string): CryptoDepositRequest | null {
  const deposits = getCryptoDeposits();
  return deposits.find(d => d.reference === reference) || null;
}

// Mark deposit as completed
export function completeCryptoDeposit(depositId: string, txSignature: string): CryptoDepositRequest | null {
  return updateCryptoDeposit(depositId, {
    status: 'completed',
    txSignature,
    completedAt: new Date().toISOString(),
  });
}

// Cancel a pending deposit
export function cancelCryptoDeposit(depositId: string): boolean {
  const deposits = getCryptoDeposits();
  const index = deposits.findIndex(d => d.id === depositId);
  
  if (index === -1) return false;
  
  // Remove from the list
  deposits.splice(index, 1);
  saveDeposits(deposits);
  
  return true;
}

// Get used transaction signatures
export function getUsedTransactions(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(USED_TX_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Check if a transaction has been used
export function isTransactionUsed(txSignature: string): boolean {
  const normalized = txSignature.trim();
  const used = getUsedTransactions();
  return used.includes(normalized);
}

// Mark a transaction as used
export function markTransactionUsed(txSignature: string): void {
  if (typeof window === 'undefined') return;
  const normalized = txSignature.trim();
  const used = getUsedTransactions();
  if (!used.includes(normalized)) {
    used.push(normalized);
    localStorage.setItem(USED_TX_KEY, JSON.stringify(used));
  }
}

