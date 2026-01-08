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
    const { cardId, action } = body;

    // Validate required fields
    if (!cardId) {
      return NextResponse.json(
        { success: false, message: 'Card ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['freeze', 'unfreeze'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action must be "freeze" or "unfreeze"' },
        { status: 400 }
      );
    }

    const response = await fetch(`${KRIPICARD_BASE_URL}/Freeze_Unfreeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        card_id: cardId,
        action,
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
        { success: false, message: data.message || 'Failed to update card status' },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Freeze/unfreeze card error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
