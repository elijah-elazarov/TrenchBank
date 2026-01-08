import { NextRequest, NextResponse } from 'next/server';
import { createPayment } from '@/lib/cryptomus';

// Minimum deposit amount in USD
const MIN_DEPOSIT = 20;
const DEPOSIT_FEE_PERCENT = 2;
const DEPOSIT_FEE_FIXED = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, walletAddress, currency } = body;

    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate amount
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < MIN_DEPOSIT) {
      return NextResponse.json(
        { success: false, message: `Minimum deposit is $${MIN_DEPOSIT}` },
        { status: 400 }
      );
    }

    // Calculate fee (similar to KripiCard: 2% + $5)
    const fee = (depositAmount * DEPOSIT_FEE_PERCENT / 100) + DEPOSIT_FEE_FIXED;
    const totalAmount = depositAmount + fee;

    // Generate unique order ID
    const orderId = `TB-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Get the base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';

    console.log('=== CREATING CRYPTOMUS PAYMENT ===');
    console.log('Order ID:', orderId);
    console.log('Amount:', depositAmount, 'Fee:', fee, 'Total:', totalAmount);
    console.log('Wallet:', walletAddress);
    console.log('Base URL:', baseUrl);

    // Create payment invoice via Cryptomus
    const paymentResponse = await createPayment({
      amount: totalAmount,
      orderId,
      walletAddress,
      currency: currency || undefined,
      urlCallback: `${baseUrl}/api/deposit/webhook`,
      urlReturn: `${baseUrl}/cards`,
      urlSuccess: `${baseUrl}/cards?deposit=success`,
    });

    console.log('=== CRYPTOMUS RESPONSE ===');
    console.log(JSON.stringify(paymentResponse, null, 2));

    if (!paymentResponse.success || !paymentResponse.result) {
      return NextResponse.json(
        { 
          success: false, 
          message: paymentResponse.message || 'Failed to create payment invoice' 
        },
        { status: 502 }
      );
    }

    const { result } = paymentResponse;

    return NextResponse.json({
      success: true,
      message: 'Payment invoice created',
      data: {
        depositId: orderId,
        paymentId: result.uuid,
        paymentUrl: result.url,
        amount: depositAmount,
        fee,
        totalAmount,
        currency: 'USD',
        expiresAt: result.expired_at,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('Create deposit error:', error);
    
    // Check if it's a config error
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { success: false, message: 'Payment system not configured. Please contact support.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

