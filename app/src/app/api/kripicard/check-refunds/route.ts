import { NextResponse } from 'next/server';
import { 
  loadPendingRefunds, 
  updateRefundStatus, 
  cleanupExpiredRefunds,
  PendingRefund 
} from '@/lib/pending-refunds';

const KRIPICARD_BASE_URL = 'https://kripicard.com/api/premium';

// Get current KripiCard balance
async function getKripiCardBalance(): Promise<number | null> {
  try {
    const apiKey = process.env.KRIPICARD_API_KEY;
    if (!apiKey) return null;

    // Try to get balance from the API
    // Note: KripiCard may not have a direct balance API, 
    // so we might need to scrape the dashboard or use another method
    
    // For now, we'll create an endpoint that can be called manually
    // with the current balance as a parameter
    return null;
  } catch (error) {
    console.error('Failed to get KripiCard balance:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Clean up expired refunds
    cleanupExpiredRefunds();
    
    const pendingRefunds = loadPendingRefunds();
    const pending = pendingRefunds.filter(r => r.status === 'pending');
    
    return NextResponse.json({
      success: true,
      pendingRefunds: pending,
      totalPending: pending.length,
      totalAmount: pending.reduce((sum, r) => sum + r.amount, 0),
    });
  } catch (error) {
    console.error('Check refunds error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST to manually process a refund when detected
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refundId, currentKripiCardBalance } = body;

    if (!refundId) {
      return NextResponse.json(
        { success: false, message: 'refundId is required' },
        { status: 400 }
      );
    }

    const pendingRefunds = loadPendingRefunds();
    const refund = pendingRefunds.find(r => r.id === refundId);

    if (!refund) {
      return NextResponse.json(
        { success: false, message: 'Refund not found' },
        { status: 404 }
      );
    }

    if (refund.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: `Refund already ${refund.status}` },
        { status: 400 }
      );
    }

    // If current balance is provided, check if refund arrived
    if (currentKripiCardBalance !== undefined) {
      const expectedBalance = refund.kripiCardBalanceBefore;
      const refundArrived = currentKripiCardBalance >= expectedBalance - 1; // Allow $1 tolerance

      if (!refundArrived) {
        return NextResponse.json({
          success: false,
          message: 'Refund not yet detected',
          expectedBalance,
          currentBalance: currentKripiCardBalance,
        });
      }
    }

    // Credit the user's TrenchBank balance
    const creditResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deposit/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: refund.walletAddress,
        action: 'credit',
        amount: refund.amount,
      }),
    });

    const creditResult = await creditResponse.json();

    if (!creditResult.success) {
      return NextResponse.json({
        success: false,
        message: 'Failed to credit user balance',
        error: creditResult.message,
      });
    }

    // Update refund status
    updateRefundStatus(refundId, 'credited', {
      creditedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Refunded $${refund.amount.toFixed(2)} to user ${refund.walletAddress.slice(0, 8)}...`,
      refund: {
        ...refund,
        status: 'credited',
        creditedAt: new Date().toISOString(),
      },
      newBalance: creditResult.data?.balance,
    });
  } catch (error) {
    console.error('Process refund error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

