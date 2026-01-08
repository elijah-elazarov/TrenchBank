import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// File-based card store (persists across server restarts)
const CARDS_FILE = join(process.cwd(), 'data', 'cards.json');

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

function loadCards(): StoredCard[] {
  try {
    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    if (!existsSync(CARDS_FILE)) {
      return [];
    }
    
    const data = readFileSync(CARDS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveCards(cards: StoredCard[]): void {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2));
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
    
    const allCards = loadCards();
    const userCards = allCards.filter(c => c.walletAddress === walletAddress);
    
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
    
    const allCards = loadCards();
    
    // Check if card already exists
    const existingIndex = allCards.findIndex(c => c.cardId === cardId);
    if (existingIndex !== -1) {
      // Update existing card
      allCards[existingIndex] = {
        ...allCards[existingIndex],
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
      allCards.push(newCard);
    }
    
    saveCards(allCards);
    
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

