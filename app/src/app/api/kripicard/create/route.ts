import { NextRequest, NextResponse } from 'next/server';

const KRIPICARD_API_URL = 'https://kripicard.com/api/premium';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.KRIPICARD_API_KEY;
    const defaultBankBin = process.env.KRIPICARD_BANK_BIN;
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Kripicard API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { amount, bankBin, firstName, lastName } = body;
    
    const finalBankBin = bankBin || defaultBankBin;

    if (!amount || amount < 10) {
      return NextResponse.json(
        { success: false, message: 'Minimum card amount is $10' },
        { status: 400 }
      );
    }

    if (!finalBankBin) {
      return NextResponse.json(
        { success: false, message: 'Bank BIN is required.' },
        { status: 400 }
      );
    }

    // Build request body - KripiCard expects strings, not numbers
    const requestBody: Record<string, unknown> = {
      api_key: apiKey,
      amount: String(amount),
      bankBin: String(finalBankBin),
    };

    // KripiCard uses name_on_card, not first_name/last_name
    if (firstName && lastName) {
      requestBody.name_on_card = `${String(firstName).substring(0, 25)} ${String(lastName).substring(0, 25)}`.trim();
    } else if (firstName) {
      requestBody.name_on_card = String(firstName).substring(0, 50);
    } else {
      requestBody.name_on_card = 'Trench Bank'; // Default name
    }

    console.log('=== KRIPICARD CREATE CARD ===');
    console.log('Amount:', amount, 'BIN:', finalBankBin);

    const response = await fetch(`${KRIPICARD_API_URL}/Create_card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid response from Kripicard API' },
        { status: 502 }
      );
    }

    if (!data.success) {
      // Check for insufficient funds
      if (data.message?.includes('INSUFFICIENT') || responseText.includes('INSUFFICIENT')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Kripicard account has insufficient funds. Please fund your Kripicard account first.',
            needsFunding: true,
          },
          { status: 402 } // Payment Required
        );
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
      },
    });
  } catch (error) {
    console.error('Create card error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
