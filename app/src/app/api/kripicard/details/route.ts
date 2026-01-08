import { NextRequest, NextResponse } from 'next/server';

const KRIPICARD_BASE_URL = 'https://kripicard.com/api/premium';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.KRIPICARD_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Kripicard API key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json(
        { success: false, message: 'Card ID is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${KRIPICARD_BASE_URL}/Get_CardDetails?api_key=${encodeURIComponent(apiKey)}&card_id=${encodeURIComponent(cardId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

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
        { success: false, message: data.message || 'Failed to get card details' },
        { status: response.status || 400 }
      );
    }

    // Debug: Log the raw response from Kripicard
    console.log('=== KRIPICARD GET DETAILS RAW RESPONSE ===');
    console.log('Card ID:', cardId);
    console.log('Raw data:', JSON.stringify(data, null, 2));

    // Map Kripicard API response to our expected format
    // Kripicard may use different field names, so we normalize them
    const rawDetails = data.data?.details || data.details || data;
    
    console.log('Raw details object:', JSON.stringify(rawDetails, null, 2));

    // Try to parse combined expiry formats like "MM/YY" or "MM/YYYY"
    let expiryMonth = rawDetails.expiry_month || rawDetails.expiryMonth || rawDetails.exp_month || rawDetails.expMonth || rawDetails.month || rawDetails.mm || '';
    let expiryYear = rawDetails.expiry_year || rawDetails.expiryYear || rawDetails.exp_year || rawDetails.expYear || rawDetails.year || rawDetails.yy || rawDetails.yyyy || '';
    
    // Check for combined expiry field - handle many possible field names
    const combinedExpiry = rawDetails.expiry || rawDetails.expiration || rawDetails.exp || rawDetails.card_expiry || 
                           rawDetails.valid_thru || rawDetails.validThru || rawDetails.expirationDate || rawDetails.expiration_date ||
                           rawDetails.card_exp || rawDetails.cardExpiry || rawDetails.expire || rawDetails.expires || 
                           rawDetails.expire_date || rawDetails.expireDate || '';
    if (combinedExpiry && (!expiryMonth || !expiryYear)) {
      const expiryStr = String(combinedExpiry);
      // Try MM/YY or MM/YYYY format
      if (expiryStr.includes('/')) {
        const parts = expiryStr.split('/');
        if (parts.length === 2) {
          expiryMonth = parts[0].trim();
          expiryYear = parts[1].trim();
        }
      } 
      // Try MM-YY or MM-YYYY format
      else if (expiryStr.includes('-')) {
        const parts = expiryStr.split('-');
        if (parts.length >= 2) {
          // Could be YYYY-MM or MM-YY, check which
          if (parts[0].length === 4) {
            // YYYY-MM format
            expiryYear = parts[0].trim();
            expiryMonth = parts[1].trim();
          } else {
            // MM-YY format
            expiryMonth = parts[0].trim();
            expiryYear = parts[1].trim();
          }
        }
      }
      // Try MMYY or MMYYYY format (no separator)
      else if (expiryStr.length === 4) {
        expiryMonth = expiryStr.substring(0, 2);
        expiryYear = expiryStr.substring(2, 4);
      } else if (expiryStr.length === 6) {
        expiryMonth = expiryStr.substring(0, 2);
        expiryYear = expiryStr.substring(2, 6);
      }
    }
    
    console.log('Parsed expiry - month:', expiryMonth, 'year:', expiryYear);

    const normalizedDetails = {
      card_number: rawDetails.card_number || rawDetails.cardNumber || rawDetails.card_num || rawDetails.number || rawDetails.pan || '',
      cvv: rawDetails.cvv || rawDetails.cvc || rawDetails.cvv2 || rawDetails.security_code || '',
      expiry_month: String(expiryMonth),
      expiry_year: String(expiryYear),
      balance: parseFloat(rawDetails.balance ?? rawDetails.available_balance ?? rawDetails.card_balance) || 0,
      status: rawDetails.status || rawDetails.card_status || 'active',
      billing_address: rawDetails.billing_address || rawDetails.billingAddress,
    };

    console.log('Normalized details:', JSON.stringify(normalizedDetails, null, 2));

    const normalizedResponse = {
      success: true,
      message: data.message || 'Card details retrieved successfully',
      data: {
        details: normalizedDetails,
        Transactions: data.data?.Transactions || data.Transactions || [],
      },
    };

    return NextResponse.json(normalizedResponse);
  } catch (error) {
    console.error('Get card details error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
