import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

// Key prefix for balance storage
const BALANCE_PREFIX = 'balance:';

interface UserBalance {
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  lastUpdated: string;
}

// Get balance from Vercel KV
async function getBalance(walletAddress: string): Promise<UserBalance> {
  try {
    const balance = await kv.get<UserBalance>(`${BALANCE_PREFIX}${walletAddress}`);
    return balance || {
      balance: 0,
      totalDeposited: 0,
      totalSpent: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get balance from KV:', error);
    return {
      balance: 0,
      totalDeposited: 0,
      totalSpent: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Save balance to Vercel KV
async function saveBalance(walletAddress: string, balance: UserBalance): Promise<void> {
  try {
    await kv.set(`${BALANCE_PREFIX}${walletAddress}`, balance);
  } catch (error) {
    console.error('Failed to save balance to KV:', error);
    throw error;
  }
}

// Get balance
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

    const balance = await getBalance(walletAddress);

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

    const current = await getBalance(walletAddress);

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
    await saveBalance(walletAddress, current);

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
