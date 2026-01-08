import { NextRequest, NextResponse } from 'next/server';

// Helper to extract and combine cookies
function extractCookies(setCookieHeader: string | null): Record<string, string> {
  if (!setCookieHeader) return {};
  const cookies: Record<string, string> = {};
  
  // Handle multiple Set-Cookie headers (they come as comma-separated sometimes)
  const cookieParts = setCookieHeader.split(/,(?=[^;]*=)/);
  
  for (const part of cookieParts) {
    const match = part.match(/^([^=]+)=([^;]*)/);
    if (match) {
      cookies[match[1].trim()] = match[2];
    }
  }
  return cookies;
}

function cookiesToString(cookies: Record<string, string>): string {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Attempt to create a deposit on KripiCard via their internal API
// This bypasses the broken frontend form

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount < 1) {
      return NextResponse.json(
        { success: false, message: 'Amount must be at least $1' },
        { status: 400 }
      );
    }

    const username = process.env.KRIPICARD_USERNAME;
    const password = process.env.KRIPICARD_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'KripiCard credentials not configured' },
        { status: 500 }
      );
    }

    let allCookies: Record<string, string> = {};

    // Step 1: Get login page to obtain CSRF token and session cookie
    console.log('=== GETTING LOGIN PAGE ===');
    const loginPageResponse = await fetch('https://kripicard.com/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    const loginPageHtml = await loginPageResponse.text();
    
    // Extract all Set-Cookie headers
    const rawHeaders = loginPageResponse.headers;
    rawHeaders.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        Object.assign(allCookies, extractCookies(value));
      }
    });
    
    console.log('Initial cookies:', Object.keys(allCookies));
    
    // Extract CSRF token from login page
    const loginCsrfMatch = loginPageHtml.match(/name="([^"]+)"\s+value="([a-zA-Z0-9]{40})"/);
    const loginCsrfToken = loginCsrfMatch ? loginCsrfMatch[2] : null;
    const loginCsrfName = loginCsrfMatch ? loginCsrfMatch[1] : '_token';
    
    console.log('Login CSRF Token found:', loginCsrfToken ? `Yes (${loginCsrfName})` : 'No');

    if (!loginCsrfToken) {
      return NextResponse.json(
        { success: false, message: 'Could not get CSRF token from login page' },
        { status: 500 }
      );
    }

    // Step 2: Submit login
    console.log('=== KRIPICARD LOGIN ===');
    const loginResponse = await fetch('https://kripicard.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': cookiesToString(allCookies),
        'Origin': 'https://kripicard.com',
        'Referer': 'https://kripicard.com/login',
      },
      body: new URLSearchParams({
        [loginCsrfName]: loginCsrfToken,
        username,
        password,
      }),
      redirect: 'manual',
    });

    console.log('Login response status:', loginResponse.status);
    
    // Get cookies from login response and merge
    loginResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        Object.assign(allCookies, extractCookies(value));
      }
    });
    
    console.log('After login cookies:', Object.keys(allCookies));
    
    // Check if login was successful by checking redirect location
    const loginRedirect = loginResponse.headers.get('location');
    console.log('Login redirect:', loginRedirect);

    // If redirected back to login, authentication failed
    if (loginRedirect && loginRedirect.includes('login')) {
      return NextResponse.json(
        { success: false, message: 'Failed to login to KripiCard - invalid credentials' },
        { status: 401 }
      );
    }

    // Step 3: Get CSRF token from deposit page
    console.log('=== GETTING DEPOSIT PAGE ===');
    const depositPageResponse = await fetch('https://kripicard.com/user/deposit', {
      method: 'GET',
      headers: {
        'Cookie': cookiesToString(allCookies),
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    // Update cookies from deposit page response
    depositPageResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        Object.assign(allCookies, extractCookies(value));
      }
    });

    const depositPageHtml = await depositPageResponse.text();
    console.log('Deposit page status:', depositPageResponse.status);
    
    // Check if we got redirected to login (session invalid)
    if (depositPageHtml.includes('Redirecting to') && depositPageHtml.includes('login')) {
      return NextResponse.json(
        { success: false, message: 'Session expired - could not access deposit page' },
        { status: 401 }
      );
    }
    
    // Extract CSRF token from the page
    const csrfMatch = depositPageHtml.match(/name="([^"]+)"\s+value="([a-zA-Z0-9]{40})"/);
    const csrfToken = csrfMatch ? csrfMatch[2] : null;
    const csrfName = csrfMatch ? csrfMatch[1] : '_token';
    
    console.log('Deposit CSRF Token found:', csrfToken ? `Yes (${csrfName})` : 'No');

    if (!csrfToken) {
      return NextResponse.json(
        { success: false, message: 'Could not get CSRF token from deposit page', pagePreview: depositPageHtml.substring(0, 500) },
        { status: 500 }
      );
    }

    // Step 4: Submit deposit request
    console.log('=== SUBMITTING DEPOSIT ===');
    const depositResponse = await fetch('https://kripicard.com/user/deposit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookiesToString(allCookies),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://kripicard.com',
        'Referer': 'https://kripicard.com/user/deposit',
      },
      body: new URLSearchParams({
        [csrfName]: csrfToken,
        amount: String(amount),
      }),
      redirect: 'manual',
    });

    console.log('Deposit response status:', depositResponse.status);
    
    // Check if we got redirected to Cryptomus payment page
    const location = depositResponse.headers.get('location');
    console.log('Redirect location:', location);

    if (location) {
      if (location.includes('cryptomus') || location.includes('pay.')) {
        return NextResponse.json({
          success: true,
          message: 'Deposit initiated - redirecting to payment',
          paymentUrl: location,
        });
      }
      
      // Follow the redirect to get the payment URL
      console.log('=== FOLLOWING REDIRECT ===');
      const redirectResponse = await fetch(location.startsWith('http') ? location : `https://kripicard.com${location}`, {
        method: 'GET',
        headers: {
          'Cookie': cookiesToString(allCookies),
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        redirect: 'manual',
      });
      
      const finalLocation = redirectResponse.headers.get('location');
      console.log('Final redirect location:', finalLocation);
      
      if (finalLocation && (finalLocation.includes('cryptomus') || finalLocation.includes('pay.'))) {
        return NextResponse.json({
          success: true,
          message: 'Deposit initiated - payment URL found',
          paymentUrl: finalLocation,
        });
      }
    }

    // If no redirect, check the response body
    const responseText = await depositResponse.text();
    console.log('Response preview:', responseText.substring(0, 1000));

    // Look for Cryptomus payment URL in the response
    const cryptomusMatch = responseText.match(/https?:\/\/[^"'\s]*cryptomus[^"'\s]*/i);
    if (cryptomusMatch) {
      return NextResponse.json({
        success: true,
        message: 'Deposit initiated - payment URL extracted',
        paymentUrl: cryptomusMatch[0],
      });
    }

    // Check for success indicators
    if (responseText.includes('success') || responseText.includes('payment') || responseText.includes('Deposit')) {
      // Try to find any payment URL
      const payUrlMatch = responseText.match(/https?:\/\/pay\.[^"'\s]+/i);
      
      return NextResponse.json({
        success: true,
        message: 'Deposit page loaded - check if payment was initiated',
        paymentUrl: payUrlMatch ? payUrlMatch[0] : null,
        note: 'The deposit form may have been submitted. Check KripiCard dashboard for pending deposits.',
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Deposit submission unclear',
      status: depositResponse.status,
      response: responseText.substring(0, 500),
    });

  } catch (error) {
    console.error('KripiCard deposit error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

