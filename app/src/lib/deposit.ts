// Client-side deposit management

export interface DepositResponse {
  success: boolean;
  message?: string;
  data?: {
    depositId: string;
    paymentId: string;
    paymentUrl: string;
    amount: number;
    fee: number;
    totalAmount: number;
    currency: string;
    expiresAt: number;
    status: string;
  };
}

export interface BalanceResponse {
  success: boolean;
  message?: string;
  data?: {
    walletAddress: string;
    balance: number;
    totalDeposited: number;
    totalSpent: number;
    lastUpdated: string;
  };
}

export interface DepositStatusResponse {
  success: boolean;
  message?: string;
  data?: {
    paymentId: string;
    orderId: string;
    status: string;
    isSuccess: boolean;
    isFinal: boolean;
    amount: string;
    paidAmount: string | null;
    creditAmount: number;
    currency: string;
    payerCurrency: string | null;
    network: string | null;
    address: string | null;
    txid: string | null;
    expiresAt: number;
    createdAt: string;
    updatedAt: string;
  };
}

class DepositClient {
  // Create a new deposit and get payment URL
  async createDeposit(params: {
    amount: number;
    walletAddress: string;
    currency?: string;
  }): Promise<DepositResponse> {
    const response = await fetch('/api/deposit/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  // Get user balance
  async getBalance(walletAddress: string): Promise<BalanceResponse> {
    const response = await fetch(`/api/deposit/balance?wallet=${encodeURIComponent(walletAddress)}`);
    return response.json();
  }

  // Update balance (internal)
  async updateBalance(params: {
    walletAddress: string;
    action: 'credit' | 'debit';
    amount: number;
  }): Promise<BalanceResponse> {
    const response = await fetch('/api/deposit/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  // Check deposit status
  async getDepositStatus(paymentId: string): Promise<DepositStatusResponse> {
    const response = await fetch(`/api/deposit/status?paymentId=${encodeURIComponent(paymentId)}`);
    return response.json();
  }
}

export const depositClient = new DepositClient();

// Local storage for pending deposits (client-side tracking)
const PENDING_DEPOSITS_KEY = 'trenchbank_pending_deposits';

export interface PendingDeposit {
  depositId: string;
  paymentId: string;
  walletAddress: string;
  amount: number;
  fee: number;
  totalAmount: number;
  createdAt: string;
}

export function getPendingDeposits(walletAddress: string): PendingDeposit[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PENDING_DEPOSITS_KEY);
  const all = stored ? JSON.parse(stored) : [];
  return all.filter((d: PendingDeposit) => d.walletAddress === walletAddress);
}

export function addPendingDeposit(deposit: PendingDeposit): void {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(PENDING_DEPOSITS_KEY);
  const all = stored ? JSON.parse(stored) : [];
  all.push(deposit);
  localStorage.setItem(PENDING_DEPOSITS_KEY, JSON.stringify(all));
}

export function removePendingDeposit(depositId: string): void {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(PENDING_DEPOSITS_KEY);
  const all = stored ? JSON.parse(stored) : [];
  const filtered = all.filter((d: PendingDeposit) => d.depositId !== depositId);
  localStorage.setItem(PENDING_DEPOSITS_KEY, JSON.stringify(filtered));
}

