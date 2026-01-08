import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Key prefix for cards storage
const CARDS_PREFIX = 'cards:';

interface StoredCard {
  id: string;
  cardId: string;
  walletAddress: string;
  createdAt: string;
  lastFour?: string;
  status: 'active' | 'frozen' | 'inactive';
  balance?: number;
  cardNumber?: string;
  cvv?: string;
  expiry?: string;
  cardHolder?: string;
}

// Get cards for a wallet from Vercel KV
async function getCards(walletAddress: string): Promise<StoredCard[]> {
  try {
    const cards = await kv.get<StoredCard[]>(`${CARDS_PREFIX}${walletAddress}`);
    return cards || [];
  } catch (error) {
    console.error('Failed to get cards from KV:', error);
    return [];
  }
}

// Save cards for a wallet to Vercel KV
async function saveCards(walletAddress: string, cards: StoredCard[]): Promise<void> {
  try {
    await kv.set(`${CARDS_PREFIX}${walletAddress}`, cards);
  } catch (error) {
    console.error('Failed to save cards to KV:', error);
    throw error;
  }
}

// GET - Retrieve cards for a wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    const userCards = await getCards(walletAddress);
    
    return NextResponse.json({
      success: true,
      cards: userCards,
    });
  } catch (error) {
    console.error('Error loading cards:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load cards' },
      { status: 500 }
    );
  }
}

// POST - Store a new card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      cardId, 
      walletAddress, 
      lastFour, 
      balance, 
      cardNumber,
      cvv,
      expiry,
      cardHolder,
    } = body;
    
    if (!cardId || !walletAddress) {
      return NextResponse.json(
        { success: false, message: 'cardId and walletAddress are required' },
        { status: 400 }
      );
    }
    
    const userCards = await getCards(walletAddress);
    
    // Check if card already exists
    const existingIndex = userCards.findIndex(c => c.cardId === cardId);
    if (existingIndex !== -1) {
      // Update existing card
      userCards[existingIndex] = {
        ...userCards[existingIndex],
        lastFour,
        balance,
        cardNumber,
        cvv,
        expiry,
        cardHolder,
      };
    } else {
      // Add new card
      const newCard: StoredCard = {
        id: crypto.randomUUID(),
        cardId,
        walletAddress,
        createdAt: new Date().toISOString(),
        lastFour,
        status: 'active',
        balance,
        cardNumber,
        cvv,
        expiry,
        cardHolder,
      };
      userCards.push(newCard);
    }
    
    await saveCards(walletAddress, userCards);
    
    return NextResponse.json({
      success: true,
      message: 'Card stored successfully',
    });
  } catch (error) {
    console.error('Error storing card:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to store card' },
      { status: 500 }
    );
  }
}
