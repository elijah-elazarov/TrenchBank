import { NextRequest, NextResponse } from 'next/server';
import { depositAndCreateCard, getApiBalance, autoDepositToKripicard } from '@/lib/kripicard-deposit';

/**
 * POST /api/kripicard/auto-create
 * 
 * Full automated flow:
 * 1. Check if Kripicard API has sufficient balance
 * 2. If not, auto-deposit from treasury
 * 3. Create the card
 * 
 * Body: { amount: number, walletAddress: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, walletAddress } = body;

    // Validate
    if (!amount || amount < 10) {
      return NextResponse.json(
        { success: false, message: 'Minimum card amount is $10' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log('=== AUTO-CREATE CARD REQUEST ===');
    console.log('Amount:', amount, 'Wallet:', walletAddress);

    // Step 1: Check current Kripicard API balance
    const currentBalance = await getApiBalance();
    console.log('Current Kripicard balance:', currentBalance);

    // Step 2: Calculate required amount (card amount + buffer for fees)
    const requiredAmount = amount * 1.15; // 15% buffer for fees
    const needsDeposit = currentBalance < requiredAmount;

    if (needsDeposit) {
      console.log('Insufficient balance, need to deposit:', requiredAmount);
      
      // Deposit enough to cover this card + some buffer
      const depositAmount = Math.max(requiredAmount, 50); // Minimum $50 deposit
      
      const result = await depositAndCreateCard(depositAmount, amount);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        data: {
          cardId: result.cardId,
          txSignature: result.txSignature,
          depositedAmount: depositAmount,
          cardAmount: amount,
        },
      }, { status: result.success ? 200 : 400 });
    }

    // Step 3: Balance is sufficient, just create the card
    console.log('Balance sufficient, creating card directly');
    
    const apiKey = process.env.KRIPICARD_API_KEY;
    const bankBin = process.env.KRIPICARD_BANK_BIN;

    const response = await fetch('https://kripicard.com/api/premium/Create_card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        amount,
        bankBin: Number(bankBin),
      }),
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid response from Kripicard' },
        { status: 502 }
      );
    }

    if (!data.success) {
      // If insufficient funds error, try depositing
      if (data.message?.includes('INSUFFICIENT')) {
        console.log('API returned insufficient funds, attempting deposit...');
        const depositResult = await autoDepositToKripicard(requiredAmount);
        
        return NextResponse.json({
          success: false,
          message: 'Deposit initiated. Please retry card creation in a few minutes.',
          data: {
            depositInitiated: true,
            txSignature: depositResult.txSignature,
            depositAddress: depositResult.depositAddress,
          },
        }, { status: 202 }); // 202 Accepted - processing
      }

      return NextResponse.json(
        { success: false, message: data.message || 'Failed to create card' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Card created successfully',
      data: {
        cardId: data.card_id,
        amount,
        walletAddress,
      },
    });
  } catch (error) {
    console.error('Auto-create card error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kripicard/auto-create
 * Check current Kripicard API balance
 */
export async function GET() {
  try {
    const balance = await getApiBalance();
    
    return NextResponse.json({
      success: true,
      data: {
        balance,
        currency: 'USD',
      },
    });
  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to get balance' },
      { status: 500 }
    );
  }
}

