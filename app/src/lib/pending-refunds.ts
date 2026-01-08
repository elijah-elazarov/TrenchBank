/**
 * Pending Refunds Tracker
 * 
 * When a card creation fails on KripiCard but money was already taken,
 * KripiCard sends a refund back. This module tracks pending refunds
 * and credits users when refunds are detected.
 * 
 * Uses Vercel KV for persistent storage.
 */

import { kv } from '@vercel/kv';

const REFUNDS_KEY = 'pending_refunds';

export interface PendingRefund {
  id: string;
  walletAddress: string; // User's wallet
  amount: number; // Amount expected to be refunded
  reason: string; // Why the refund is expected
  kripiCardBalanceBefore: number; // KripiCard balance when failure occurred
  createdAt: string;
  status: 'pending' | 'detected' | 'credited' | 'expired';
  detectedAt?: string;
  creditedAt?: string;
}

export async function loadPendingRefunds(): Promise<PendingRefund[]> {
  try {
    const refunds = await kv.get<PendingRefund[]>(REFUNDS_KEY);
    return refunds || [];
  } catch (error) {
    console.error('Failed to load pending refunds:', error);
    return [];
  }
}

export async function savePendingRefunds(refunds: PendingRefund[]): Promise<void> {
  try {
    await kv.set(REFUNDS_KEY, refunds);
  } catch (error) {
    console.error('Failed to save pending refunds:', error);
    throw error;
  }
}

export async function addPendingRefund(refund: Omit<PendingRefund, 'id' | 'createdAt' | 'status'>): Promise<PendingRefund> {
  const refunds = await loadPendingRefunds();
  
  const newRefund: PendingRefund = {
    ...refund,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  refunds.push(newRefund);
  await savePendingRefunds(refunds);
  
  console.log('Added pending refund:', newRefund);
  return newRefund;
}

export async function updateRefundStatus(
  refundId: string, 
  status: PendingRefund['status'],
  additionalData?: Partial<PendingRefund>
): Promise<void> {
  const refunds = await loadPendingRefunds();
  const index = refunds.findIndex(r => r.id === refundId);
  
  if (index !== -1) {
    refunds[index] = {
      ...refunds[index],
      ...additionalData,
      status,
    };
    await savePendingRefunds(refunds);
    console.log('Updated refund status:', refunds[index]);
  }
}

export async function getPendingRefundsForWallet(walletAddress: string): Promise<PendingRefund[]> {
  const refunds = await loadPendingRefunds();
  return refunds.filter(r => r.walletAddress === walletAddress && r.status === 'pending');
}

export async function getAllPendingRefunds(): Promise<PendingRefund[]> {
  const refunds = await loadPendingRefunds();
  return refunds.filter(r => r.status === 'pending');
}

// Clean up old refunds (older than 24 hours)
export async function cleanupExpiredRefunds(): Promise<void> {
  const refunds = await loadPendingRefunds();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  let changed = false;
  for (const refund of refunds) {
    if (refund.status === 'pending') {
      const age = now - new Date(refund.createdAt).getTime();
      if (age > ONE_DAY) {
        refund.status = 'expired';
        changed = true;
      }
    }
  }
  
  if (changed) {
    await savePendingRefunds(refunds);
  }
}
