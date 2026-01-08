import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// File-based balance store (persists across server restarts)
// In production, this would be a database
const BALANCE_FILE = join(process.cwd(), 'data', 'balances.json');

interface UserBalance {
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  lastUpdated: string;
}

// Load balances from file
function loadBalances(): Map<string, UserBalance> {
  try {
    if (existsSync(BALANCE_FILE)) {
      const data = JSON.parse(readFileSync(BALANCE_FILE, 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (error) {
    console.error('Failed to load balances:', error);
  }
  return new Map();
}

// Save balances to file
function saveBalances(balances: Map<string, UserBalance>): void {
  try {
    // Ensure data directory exists
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dataDir, { recursive: true });
    }
    const data = Object.fromEntries(balances);
    writeFileSync(BALANCE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save balances:', error);
  }
}

// Get balance - always reload from file to ensure fresh data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Always reload from file to get fresh data
    const freshBalances = loadBalances();
    const balance = freshBalances.get(walletAddress) || {
      balance: 0,
      totalDeposited: 0,
      totalSpent: 0,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        ...balance,
      },
    });
  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update balance (internal use - for crediting after deposits or debiting after card operations)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, action, amount } = body;

    if (!walletAddress || !action || typeof amount !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    // Always reload from file to get fresh data before updating
    const freshBalances = loadBalances();
    const current = freshBalances.get(walletAddress) || {
      balance: 0,
      totalDeposited: 0,
      totalSpent: 0,
      lastUpdated: new Date().toISOString(),
    };

    if (action === 'credit') {
      // Add funds (deposit completed)
      current.balance += amount;
      current.totalDeposited += amount;
    } else if (action === 'debit') {
      // Remove funds (card created/funded)
      if (current.balance < amount) {
        return NextResponse.json(
          { success: false, message: 'Insufficient balance' },
          { status: 400 }
        );
      }
      current.balance -= amount;
      current.totalSpent += amount;
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid action. Use "credit" or "debit"' },
        { status: 400 }
      );
    }

    current.lastUpdated = new Date().toISOString();
    freshBalances.set(walletAddress, current);
    
    // Persist to file
    saveBalances(freshBalances);

    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        ...current,
      },
    });
  } catch (error) {
    console.error('Update balance error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get fresh balances (for use in other modules)
export function getFreshBalances(): Map<string, UserBalance> {
  return loadBalances();
}

