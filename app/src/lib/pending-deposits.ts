/**
 * Pending Deposits Tracker
 * 
 * Tracks Kripicard deposits via Cryptomus and automatically
 * triggers card creation when deposits are confirmed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const DEPOSITS_FILE = join(DATA_DIR, 'pending_deposits.json');

export interface PendingDeposit {
  id: string;
  paymentId: string; // Cryptomus payment UUID
  walletAddress?: string; // User's wallet (if applicable)
  amountUsd: number; // Amount in USD
  amountCrypto?: string; // Amount in crypto (e.g., "0.22 SOL")
  currency: string; // SOL, BTC, ETH, etc.
  depositAddress?: string; // Cryptomus deposit address
  cryptomusUrl?: string; // Payment page URL
  transactionSignature?: string; // Blockchain transaction signature
  status: 'pending' | 'sent' | 'confirmed' | 'credited' | 'failed' | 'expired';
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  creditedAt?: string;
  cardCreated?: boolean;
  cardId?: string;
  error?: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPendingDeposits(): PendingDeposit[] {
  try {
    ensureDataDir();
    if (existsSync(DEPOSITS_FILE)) {
      const data = JSON.parse(readFileSync(DEPOSITS_FILE, 'utf-8'));
      return data;
    }
    return [];
  } catch (error) {
    console.error('Failed to load pending deposits:', error);
    return [];
  }
}

export function savePendingDeposits(deposits: PendingDeposit[]): void {
  try {
    ensureDataDir();
    writeFileSync(DEPOSITS_FILE, JSON.stringify(deposits, null, 2));
  } catch (error) {
    console.error('Failed to save pending deposits:', error);
  }
}

export function addPendingDeposit(deposit: Omit<PendingDeposit, 'id' | 'createdAt' | 'status'>): PendingDeposit {
  const deposits = loadPendingDeposits();
  
  const newDeposit: PendingDeposit = {
    ...deposit,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  deposits.push(newDeposit);
  savePendingDeposits(deposits);
  
  console.log('Added pending deposit:', newDeposit.paymentId);
  return newDeposit;
}

export function updateDepositStatus(
  paymentId: string, 
  status: PendingDeposit['status'],
  additionalData?: Partial<PendingDeposit>
): PendingDeposit | null {
  const deposits = loadPendingDeposits();
  const index = deposits.findIndex(d => d.paymentId === paymentId);
  
  if (index !== -1) {
    deposits[index] = {
      ...deposits[index],
      ...additionalData,
      status,
    };
    savePendingDeposits(deposits);
    console.log('Updated deposit status:', deposits[index].paymentId, '->', status);
    return deposits[index];
  }
  return null;
}

export function getDepositByPaymentId(paymentId: string): PendingDeposit | null {
  const deposits = loadPendingDeposits();
  return deposits.find(d => d.paymentId === paymentId) || null;
}

export function getDepositsByWallet(walletAddress: string): PendingDeposit[] {
  const deposits = loadPendingDeposits();
  return deposits.filter(d => d.walletAddress === walletAddress);
}

export function getPendingDeposits(): PendingDeposit[] {
  const deposits = loadPendingDeposits();
  return deposits.filter(d => d.status === 'pending' || d.status === 'sent');
}

export function getConfirmedDeposits(): PendingDeposit[] {
  const deposits = loadPendingDeposits();
  return deposits.filter(d => d.status === 'confirmed' || d.status === 'credited');
}

// Mark deposit as sent (transaction submitted to blockchain)
export function markDepositAsSent(
  paymentId: string, 
  transactionSignature: string
): PendingDeposit | null {
  return updateDepositStatus(paymentId, 'sent', {
    transactionSignature,
    sentAt: new Date().toISOString(),
  });
}

// Mark deposit as confirmed (Cryptomus detected the payment)
export function markDepositAsConfirmed(paymentId: string): PendingDeposit | null {
  return updateDepositStatus(paymentId, 'confirmed', {
    confirmedAt: new Date().toISOString(),
  });
}

// Mark deposit as credited (funds available in Kripicard)
export function markDepositAsCredited(
  paymentId: string, 
  cardCreated: boolean = false,
  cardId?: string
): PendingDeposit | null {
  return updateDepositStatus(paymentId, 'credited', {
    creditedAt: new Date().toISOString(),
    cardCreated,
    cardId,
  });
}

// Mark deposit as failed
export function markDepositAsFailed(paymentId: string, error: string): PendingDeposit | null {
  return updateDepositStatus(paymentId, 'failed', { error });
}

// Clean up old deposits (older than 7 days)
export function cleanupExpiredDeposits(): number {
  const deposits = loadPendingDeposits();
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  
  let expiredCount = 0;
  for (const deposit of deposits) {
    if (deposit.status === 'pending' || deposit.status === 'sent') {
      const age = now - new Date(deposit.createdAt).getTime();
      if (age > SEVEN_DAYS) {
        deposit.status = 'expired';
        expiredCount++;
      }
    }
  }
  
  if (expiredCount > 0) {
    savePendingDeposits(deposits);
    console.log(`Expired ${expiredCount} old deposits`);
  }
  
  return expiredCount;
}

// Get deposit summary
export function getDepositSummary(): {
  total: number;
  pending: number;
  sent: number;
  confirmed: number;
  credited: number;
  failed: number;
  expired: number;
  totalAmountUsd: number;
} {
  const deposits = loadPendingDeposits();
  
  return {
    total: deposits.length,
    pending: deposits.filter(d => d.status === 'pending').length,
    sent: deposits.filter(d => d.status === 'sent').length,
    confirmed: deposits.filter(d => d.status === 'confirmed').length,
    credited: deposits.filter(d => d.status === 'credited').length,
    failed: deposits.filter(d => d.status === 'failed').length,
    expired: deposits.filter(d => d.status === 'expired').length,
    totalAmountUsd: deposits.reduce((sum, d) => sum + d.amountUsd, 0),
  };
}

