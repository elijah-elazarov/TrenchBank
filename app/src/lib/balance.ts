// Balance management for TrenchBank
// Stores user balances and deposit history in localStorage (for demo purposes)
// In production, this would be stored in a database

export interface Deposit {
  id: string;
  walletAddress: string;
  amount: number; // USD
  cryptoAmount?: number;
  currency?: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paymentId?: string; // Cryptomus payment ID
  paymentUrl?: string;
  createdAt: string;
  paidAt?: string;
}

export interface UserBalance {
  walletAddress: string;
  balance: number; // USD
  totalDeposited: number;
  totalSpent: number;
  lastUpdated: string;
}

const BALANCES_KEY = 'trenchbank_balances';
const DEPOSITS_KEY = 'trenchbank_deposits';

// Get all balances from storage
function getBalances(): Record<string, UserBalance> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(BALANCES_KEY);
  return stored ? JSON.parse(stored) : {};
}

// Save balances to storage
function saveBalances(balances: Record<string, UserBalance>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
}

// Get all deposits from storage
function getDeposits(): Deposit[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(DEPOSITS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Save deposits to storage
function saveDeposits(deposits: Deposit[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEPOSITS_KEY, JSON.stringify(deposits));
}

// Get user balance
export function getUserBalance(walletAddress: string): UserBalance {
  const balances = getBalances();
  return balances[walletAddress] || {
    walletAddress,
    balance: 0,
    totalDeposited: 0,
    totalSpent: 0,
    lastUpdated: new Date().toISOString(),
  };
}

// Update user balance
export function updateUserBalance(walletAddress: string, updates: Partial<UserBalance>): UserBalance {
  const balances = getBalances();
  const current = balances[walletAddress] || {
    walletAddress,
    balance: 0,
    totalDeposited: 0,
    totalSpent: 0,
    lastUpdated: new Date().toISOString(),
  };
  
  balances[walletAddress] = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  
  saveBalances(balances);
  return balances[walletAddress];
}

// Add funds to user balance (after successful deposit)
export function creditBalance(walletAddress: string, amount: number): UserBalance {
  const current = getUserBalance(walletAddress);
  return updateUserBalance(walletAddress, {
    balance: current.balance + amount,
    totalDeposited: current.totalDeposited + amount,
  });
}

// Deduct funds from user balance (when creating/funding cards)
export function debitBalance(walletAddress: string, amount: number): UserBalance | null {
  const current = getUserBalance(walletAddress);
  if (current.balance < amount) {
    return null; // Insufficient funds
  }
  return updateUserBalance(walletAddress, {
    balance: current.balance - amount,
    totalSpent: current.totalSpent + amount,
  });
}

// Check if user has sufficient balance
export function hasSufficientBalance(walletAddress: string, amount: number): boolean {
  const current = getUserBalance(walletAddress);
  return current.balance >= amount;
}

// Create a new deposit record
export function createDeposit(deposit: Omit<Deposit, 'id' | 'createdAt'>): Deposit {
  const deposits = getDeposits();
  const newDeposit: Deposit = {
    ...deposit,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  deposits.push(newDeposit);
  saveDeposits(deposits);
  return newDeposit;
}

// Update deposit status
export function updateDeposit(depositId: string, updates: Partial<Deposit>): Deposit | null {
  const deposits = getDeposits();
  const index = deposits.findIndex(d => d.id === depositId);
  if (index === -1) return null;
  
  deposits[index] = { ...deposits[index], ...updates };
  saveDeposits(deposits);
  return deposits[index];
}

// Find deposit by payment ID (Cryptomus payment ID)
export function findDepositByPaymentId(paymentId: string): Deposit | null {
  const deposits = getDeposits();
  return deposits.find(d => d.paymentId === paymentId) || null;
}

// Get user's deposit history
export function getUserDeposits(walletAddress: string): Deposit[] {
  const deposits = getDeposits();
  return deposits
    .filter(d => d.walletAddress === walletAddress)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get pending deposits for a user
export function getPendingDeposits(walletAddress: string): Deposit[] {
  return getUserDeposits(walletAddress).filter(d => d.status === 'pending');
}

// Mark deposit as paid and credit user balance
export function completeDeposit(depositId: string): Deposit | null {
  const deposits = getDeposits();
  const deposit = deposits.find(d => d.id === depositId);
  
  if (!deposit || deposit.status !== 'pending') {
    return null;
  }
  
  // Update deposit status
  const updated = updateDeposit(depositId, {
    status: 'paid',
    paidAt: new Date().toISOString(),
  });
  
  if (updated) {
    // Credit user balance
    creditBalance(updated.walletAddress, updated.amount);
  }
  
  return updated;
}

