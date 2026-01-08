import { NextRequest, NextResponse } from 'next/server';

const KRIPICARD_BASE_URL = 'https://kripicard.com/api/premium';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.KRIPICARD_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Kripicard API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { cardId, amount } = body;

    // Validate required fields
    if (!cardId) {
      return NextResponse.json(
        { success: false, message: 'Card ID is required' },
        { status: 400 }
      );
    }

    if (!amount || amount < 10) {
      return NextResponse.json(
        { success: false, message: 'Amount must be at least $10' },
        { status: 400 }
      );
    }

    // KripiCard expects string values, not numbers
    const response = await fetch(`${KRIPICARD_BASE_URL}/Fund_Card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        card_id: String(cardId),
        amount: String(amount),
      }),
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Kripicard returned non-JSON response:', responseText.substring(0, 200));
      return NextResponse.json(
        { 
          success: false, 
          message: 'Kripicard API returned an invalid response. The service may be temporarily unavailable.'
        },
        { status: 502 }
      );
    }

    if (!response.ok || !data.success) {
      return NextResponse.json(
        { success: false, message: data.message || 'Failed to fund card' },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fund card error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
