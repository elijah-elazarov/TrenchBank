import { NextRequest, NextResponse } from "next/server";

// In-memory storage for withdrawals (in production, use a database)
// This is shared across requests in the same server instance
const withdrawalStore = new Map<string, {
  id: string;
  walletAddress: string;
  destinationAddress: string;
  amount: number;
  cryptoAmount: number;
  currency: string;
  network: string;
  status: string;
  createdAt: string;
}>();

// Balance storage (simple in-memory, should be database in production)
const balanceStore = new Map<string, number>();

// Withdrawal fees
const WITHDRAWAL_FEES: Record<string, number> = {
  SOL: 0.01,
  USDT: 0.01,
  ETH: 0.02,
};

// Network fees in USD
const NETWORK_FEES: Record<string, number> = {
  SOL: 0.01,
  USDT: 0.02,
  ETH: 5,
};

// Minimum withdrawals
const MIN_WITHDRAWAL: Record<string, number> = {
  SOL: 10,
  USDT: 10,
  ETH: 25,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, destinationAddress, amount, currency, network, cryptoPrice } = body;

    // Validate required fields
    if (!walletAddress || !destinationAddress || !amount || !currency || !network || !cryptoPrice) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate minimum withdrawal
    const minAmount = MIN_WITHDRAWAL[currency] || 10;
    if (amount < minAmount) {
      return NextResponse.json(
        { success: false, message: `Minimum withdrawal for ${currency} is $${minAmount}` },
        { status: 400 }
      );
    }

    // Validate destination address format
    if (network === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationAddress)) {
        return NextResponse.json(
          { success: false, message: "Invalid Solana address" },
          { status: 400 }
        );
      }
    } else if (network === 'ethereum') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
        return NextResponse.json(
          { success: false, message: "Invalid Ethereum address" },
          { status: 400 }
        );
      }
    }

    // Get user's current balance (from the balance API storage)
    // In production, this would be a database query
    const balanceResponse = await fetch(`${req.nextUrl.origin}/api/deposit/balance?walletAddress=${walletAddress}`);
    const balanceData = await balanceResponse.json();
    const currentBalance = balanceData.success ? balanceData.data.balance : 0;

    if (currentBalance < amount) {
      return NextResponse.json(
        { success: false, message: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Calculate fees
    const feePercent = WITHDRAWAL_FEES[currency] || 0.01;
    const feeUsd = amount * feePercent;
    const networkFeeUsd = NETWORK_FEES[currency] || 0;
    const netAmountUsd = amount - feeUsd - networkFeeUsd;
    const cryptoAmount = netAmountUsd / cryptoPrice;

    if (netAmountUsd <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount too small after fees" },
        { status: 400 }
      );
    }

    // Create withdrawal request
    const withdrawalId = crypto.randomUUID();
    const withdrawal = {
      id: withdrawalId,
      walletAddress,
      destinationAddress,
      amount,
      cryptoAmount,
      currency,
      network,
      status: 'pending',
      feeUsd,
      networkFeeUsd,
      netAmountUsd,
      createdAt: new Date().toISOString(),
    };

    // Store the withdrawal
    withdrawalStore.set(withdrawalId, withdrawal);

    // Deduct balance immediately (will be refunded if withdrawal fails)
    await fetch(`${req.nextUrl.origin}/api/deposit/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        action: 'debit',
        amount,
      }),
    });

    return NextResponse.json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Withdrawal create error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create withdrawal" },
      { status: 500 }
    );
  }
}

// Get withdrawal status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const withdrawalId = searchParams.get('id');
  const walletAddress = searchParams.get('walletAddress');

  if (withdrawalId) {
    const withdrawal = withdrawalStore.get(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json(
        { success: false, message: "Withdrawal not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: withdrawal });
  }

  if (walletAddress) {
    const withdrawals = Array.from(withdrawalStore.values())
      .filter(w => w.walletAddress === walletAddress)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ success: true, data: withdrawals });
  }

  return NextResponse.json(
    { success: false, message: "Missing id or walletAddress" },
    { status: 400 }
  );
}

