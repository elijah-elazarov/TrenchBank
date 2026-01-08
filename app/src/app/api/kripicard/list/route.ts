import { NextResponse } from 'next/server';

const KRIPICARD_BASE_URL = 'https://kripicard.com/api/premium';

export async function GET() {
  try {
    const apiKey = process.env.KRIPICARD_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Kripicard API key not configured' },
        { status: 500 }
      );
    }

    // Try different endpoint patterns that might list cards
    const endpoints = [
      `${KRIPICARD_BASE_URL}/List_Cards?api_key=${apiKey}`,
      `${KRIPICARD_BASE_URL}/Get_Cards?api_key=${apiKey}`,
      `${KRIPICARD_BASE_URL}/Cards?api_key=${apiKey}`,
      `https://kripicard.com/api/cards?api_key=${apiKey}`,
    ];

    const results = [];

    for (const url of endpoints) {
      try {
        console.log('Trying:', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        const text = await response.text();
        console.log(`Response from ${url}:`, response.status, text.substring(0, 200));
        
        results.push({
          url: url.replace(apiKey, '***'),
          status: response.status,
          body: text.substring(0, 300),
        });

        // If we got a successful response with cards, return it
        if (response.ok) {
          try {
            const data = JSON.parse(text);
            if (data.success && (data.cards || data.data)) {
              return NextResponse.json({
                success: true,
                cards: data.cards || data.data,
                endpoint: url.replace(apiKey, '***'),
              });
            }
          } catch {}
        }
      } catch (err) {
        results.push({
          url: url.replace(apiKey, '***'),
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Could not find cards list endpoint',
      attempts: results,
    });
  } catch (error) {
    console.error('List cards error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

