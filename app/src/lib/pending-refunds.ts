/**
 * Pending Refunds Tracker
 * 
 * When a card creation fails on KripiCard but money was already taken,
 * KripiCard sends a refund back. This module tracks pending refunds
 * and credits users when refunds are detected.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const REFUNDS_FILE = join(DATA_DIR, 'pending_refunds.json');

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

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPendingRefunds(): PendingRefund[] {
  try {
    ensureDataDir();
    if (existsSync(REFUNDS_FILE)) {
      const data = JSON.parse(readFileSync(REFUNDS_FILE, 'utf-8'));
      return data;
    }
    return [];
  } catch (error) {
    console.error('Failed to load pending refunds:', error);
    return [];
  }
}

export function savePendingRefunds(refunds: PendingRefund[]): void {
  try {
    ensureDataDir();
    writeFileSync(REFUNDS_FILE, JSON.stringify(refunds, null, 2));
  } catch (error) {
    console.error('Failed to save pending refunds:', error);
  }
}

export function addPendingRefund(refund: Omit<PendingRefund, 'id' | 'createdAt' | 'status'>): PendingRefund {
  const refunds = loadPendingRefunds();
  
  const newRefund: PendingRefund = {
    ...refund,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  refunds.push(newRefund);
  savePendingRefunds(refunds);
  
  console.log('Added pending refund:', newRefund);
  return newRefund;
}

export function updateRefundStatus(
  refundId: string, 
  status: PendingRefund['status'],
  additionalData?: Partial<PendingRefund>
): void {
  const refunds = loadPendingRefunds();
  const index = refunds.findIndex(r => r.id === refundId);
  
  if (index !== -1) {
    refunds[index] = {
      ...refunds[index],
      ...additionalData,
      status,
    };
    savePendingRefunds(refunds);
    console.log('Updated refund status:', refunds[index]);
  }
}

export function getPendingRefundsForWallet(walletAddress: string): PendingRefund[] {
  const refunds = loadPendingRefunds();
  return refunds.filter(r => r.walletAddress === walletAddress && r.status === 'pending');
}

export function getAllPendingRefunds(): PendingRefund[] {
  const refunds = loadPendingRefunds();
  return refunds.filter(r => r.status === 'pending');
}

// Clean up old refunds (older than 24 hours)
export function cleanupExpiredRefunds(): void {
  const refunds = loadPendingRefunds();
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
    savePendingRefunds(refunds);
  }
}

