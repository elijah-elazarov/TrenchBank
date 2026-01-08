/**
 * Kripicard API Client
 * https://home.kripicard.com/api
 * 
 * This module provides TypeScript types and API functions for interacting
 * with the Kripicard virtual debit card service.
 */

// ============ Types ============

export interface CreateCardParams {
  amount: number; // Minimum 10 USD
  bankBin?: number; // Optional - uses KRIPICARD_BANK_BIN env var if not provided
  firstName?: string;
  lastName?: string;
}

export interface CreateCardResponse {
  success: boolean;
  message: string;
  card_id?: string;
}

export interface FundCardParams {
  cardId: string;
  amount: number; // Minimum 10 USD
}

export interface FundCardResponse {
  success: boolean;
  message: string;
  data?: {
    card_id: string;
    amount: number;
    fee: number;
    total_debited: number;
    reference: string;
    created_at: string;
    updated_at: string;
  };
}

export interface CardDetails {
  card_number: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
  balance: number;
  status: 'active' | 'frozen' | 'inactive';
  billing_address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface CardTransaction {
  id: string;
  type: 'charge' | 'refund' | 'funding';
  amount: number;
  merchant?: string;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

export interface GetCardDetailsResponse {
  success: boolean;
  message: string;
  data?: {
    details: CardDetails;
    Transactions: CardTransaction[];
  };
}

export interface FreezeUnfreezeParams {
  cardId: string;
  action: 'freeze' | 'unfreeze';
}

export interface FreezeUnfreezeResponse {
  success: boolean;
  message: string;
  data?: {
    action: 'freeze' | 'unfreeze';
    card_id: string;
    status: string;
    updated_at: string;
  };
}

export interface KripicardError {
  success: false;
  message: string;
  error?: string;
}

// Stored card reference (what we store locally)
export interface StoredCard {
  id: string;
  cardId: string;
  walletAddress: string;
  createdAt: string;
  lastFour?: string;
  status: 'active' | 'frozen' | 'inactive';
  balance?: number;
  expiry?: string; // Format: "MM/YY" or "MM/YYYY"
  cardNumber?: string;
  cvv?: string;
  cardHolder?: string;
}

// ============ API Client (Frontend calls to our API routes) ============

const API_BASE = '/api/kripicard';

class KripicardClient {
  /**
   * Create a new virtual debit card
   */
  async createCard(params: CreateCardParams): Promise<CreateCardResponse> {
    const response = await fetch(`${API_BASE}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create card');
    }

    return response.json();
  }

  /**
   * Fund an existing card
   */
  async fundCard(params: FundCardParams): Promise<FundCardResponse> {
    const response = await fetch(`${API_BASE}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fund card');
    }

    return response.json();
  }

  /**
   * Get card details and transactions
   */
  async getCardDetails(cardId: string): Promise<GetCardDetailsResponse> {
    const response = await fetch(`${API_BASE}/details?cardId=${encodeURIComponent(cardId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get card details');
    }

    return response.json();
  }

  /**
   * Freeze or unfreeze a card
   */
  async freezeUnfreeze(params: FreezeUnfreezeParams): Promise<FreezeUnfreezeResponse> {
    const response = await fetch(`${API_BASE}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update card status');
    }

    return response.json();
  }
}

export const kripicardClient = new KripicardClient();

// ============ Local Storage Helpers ============

const CARDS_STORAGE_KEY = 'kripicard_cards';

export function getStoredCards(walletAddress: string): StoredCard[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!stored) return [];
    
    const allCards: StoredCard[] = JSON.parse(stored);
    return allCards.filter(card => card.walletAddress === walletAddress);
  } catch {
    return [];
  }
}

export function storeCard(card: StoredCard): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(CARDS_STORAGE_KEY);
    const allCards: StoredCard[] = stored ? JSON.parse(stored) : [];
    allCards.push(card);
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(allCards));
  } catch (e) {
    console.error('Failed to store card:', e);
  }
}

export function updateStoredCard(cardId: string, updates: Partial<StoredCard>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(CARDS_STORAGE_KEY);
    if (!stored) return;
    
    const allCards: StoredCard[] = JSON.parse(stored);
    const index = allCards.findIndex(c => c.cardId === cardId);
    if (index !== -1) {
      allCards[index] = { ...allCards[index], ...updates };
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(allCards));
    }
  } catch (e) {
    console.error('Failed to update card:', e);
  }
}

