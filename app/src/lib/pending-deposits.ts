/**
 * Pending Deposits Tracker
 * 
 * Tracks Kripicard deposits via Cryptomus and automatically
 * triggers card creation when deposits are confirmed.
 * 
 * Uses Vercel KV for persistent storage.
 */

import { kv } from '@vercel/kv';

const DEPOSITS_KEY = 'pending_deposits';

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

export async function loadPendingDeposits(): Promise<PendingDeposit[]> {
  try {
    const deposits = await kv.get<PendingDeposit[]>(DEPOSITS_KEY);
    return deposits || [];
  } catch (error) {
    console.error('Failed to load pending deposits:', error);
    return [];
  }
}

export async function savePendingDeposits(deposits: PendingDeposit[]): Promise<void> {
  try {
    await kv.set(DEPOSITS_KEY, deposits);
  } catch (error) {
    console.error('Failed to save pending deposits:', error);
    throw error;
  }
}

export async function addPendingDeposit(deposit: Omit<PendingDeposit, 'id' | 'createdAt' | 'status'>): Promise<PendingDeposit> {
  const deposits = await loadPendingDeposits();
  
  const newDeposit: PendingDeposit = {
    ...deposit,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  deposits.push(newDeposit);
  await savePendingDeposits(deposits);
  
  console.log('Added pending deposit:', newDeposit.paymentId);
  return newDeposit;
}

export async function updateDepositStatus(
  paymentId: string, 
  status: PendingDeposit['status'],
  additionalData?: Partial<PendingDeposit>
): Promise<PendingDeposit | null> {
  const deposits = await loadPendingDeposits();
  const index = deposits.findIndex(d => d.paymentId === paymentId);
  
  if (index !== -1) {
    deposits[index] = {
      ...deposits[index],
      ...additionalData,
      status,
    };
    await savePendingDeposits(deposits);
    console.log('Updated deposit status:', deposits[index].paymentId, '->', status);
    return deposits[index];
  }
  return null;
}

export async function getDepositByPaymentId(paymentId: string): Promise<PendingDeposit | null> {
  const deposits = await loadPendingDeposits();
  return deposits.find(d => d.paymentId === paymentId) || null;
}

export async function getDepositsByWallet(walletAddress: string): Promise<PendingDeposit[]> {
  const deposits = await loadPendingDeposits();
  return deposits.filter(d => d.walletAddress === walletAddress);
}

export async function getPendingDeposits(): Promise<PendingDeposit[]> {
  const deposits = await loadPendingDeposits();
  return deposits.filter(d => d.status === 'pending' || d.status === 'sent');
}

export async function getConfirmedDeposits(): Promise<PendingDeposit[]> {
  const deposits = await loadPendingDeposits();
  return deposits.filter(d => d.status === 'confirmed' || d.status === 'credited');
}

// Mark deposit as sent (transaction submitted to blockchain)
export async function markDepositAsSent(
  paymentId: string, 
  transactionSignature: string
): Promise<PendingDeposit | null> {
  return updateDepositStatus(paymentId, 'sent', {
    transactionSignature,
    sentAt: new Date().toISOString(),
  });
}

// Mark deposit as confirmed (Cryptomus detected the payment)
export async function markDepositAsConfirmed(paymentId: string): Promise<PendingDeposit | null> {
  return updateDepositStatus(paymentId, 'confirmed', {
    confirmedAt: new Date().toISOString(),
  });
}

// Mark deposit as credited (funds available in Kripicard)
export async function markDepositAsCredited(
  paymentId: string, 
  cardCreated: boolean = false,
  cardId?: string
): Promise<PendingDeposit | null> {
  return updateDepositStatus(paymentId, 'credited', {
    creditedAt: new Date().toISOString(),
    cardCreated,
    cardId,
  });
}

// Mark deposit as failed
export async function markDepositAsFailed(paymentId: string, error: string): Promise<PendingDeposit | null> {
  return updateDepositStatus(paymentId, 'failed', { error });
}

// Clean up old deposits (older than 7 days)
export async function cleanupExpiredDeposits(): Promise<number> {
  const deposits = await loadPendingDeposits();
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
    await savePendingDeposits(deposits);
    console.log(`Expired ${expiredCount} old deposits`);
  }
  
  return expiredCount;
}

// Get deposit summary
export async function getDepositSummary(): Promise<{
  total: number;
  pending: number;
  sent: number;
  confirmed: number;
  credited: number;
  failed: number;
  expired: number;
  totalAmountUsd: number;
}> {
  const deposits = await loadPendingDeposits();
  
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
