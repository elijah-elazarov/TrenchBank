import { NextRequest, NextResponse } from 'next/server';
import { addPendingRefund } from '@/lib/pending-refunds';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, reason, kripiCardBalanceBefore } = body;

    if (!walletAddress || !amount) {
      return NextResponse.json(
        { success: false, message: 'walletAddress and amount are required' },
        { status: 400 }
      );
    }

    // Add to pending refunds tracker
    const refund = addPendingRefund({
      walletAddress,
      amount,
      reason: reason || 'Card creation failed',
      kripiCardBalanceBefore: kripiCardBalanceBefore || 0,
    });

    console.log('=== PENDING REFUND TRACKED ===');
    console.log('Wallet:', walletAddress);
    console.log('Amount:', amount);
    console.log('Reason:', reason);
    console.log('Refund ID:', refund.id);

    return NextResponse.json({
      success: true,
      message: 'Pending refund tracked',
      refund,
    });
  } catch (error) {
    console.error('Track refund error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

