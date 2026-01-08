/**
 * Kripicard Dashboard Automation
 * Handles login, deposits via Cryptomus redirect
 */

interface KripicardSession {
  cookies: string;
  csrfToken?: string;
  expiresAt: number;
}

export interface DepositInfo {
  cryptomusUrl: string;
  cryptomusUuid: string;
  amount: number;
  currency: string;
}

export interface KripicardBalance {
  available: number;
  pending: number;
  currency: string;
}

// Session cache
let cachedSession: KripicardSession | null = null;

const KRIPICARD_BASE_URL = 'https://kripicard.com';

/**
 * Login to Kripicard dashboard and get session
 */
export async function loginToKripicard(): Promise<KripicardSession> {
  // Check if we have a valid cached session
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    console.log('Using cached Kripicard session');
    return cachedSession;
  }

  const username = process.env.KRIPICARD_USERNAME;
  const password = process.env.KRIPICARD_PASSWORD;

  if (!username || !password) {
    throw new Error('Kripicard credentials not configured');
  }

  console.log('=== LOGGING INTO KRIPICARD ===');

  // Step 1: Get login page to get CSRF token
  const loginPageResponse = await fetch(`${KRIPICARD_BASE_URL}/login`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!loginPageResponse.ok) {
    throw new Error(`Failed to load login page: ${loginPageResponse.status}`);
  }

  const loginPageHtml = await loginPageResponse.text();
  
  // Extract CSRF token
  const csrfMatch = loginPageHtml.match(/name="_token"\s+value="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : null;
  
  // Get cookies from login page
  const setCookies = loginPageResponse.headers.get('set-cookie') || '';
  
  console.log('Got CSRF token:', csrfToken ? 'Yes' : 'No');

  // Step 2: Submit login form
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  if (csrfToken) {
    formData.append('_token', csrfToken);
  }

  const loginResponse = await fetch(`${KRIPICARD_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': setCookies.split(',').map(c => c.split(';')[0]).join('; '),
      'Referer': `${KRIPICARD_BASE_URL}/login`,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  console.log('Login response status:', loginResponse.status);
  
  // Get session cookies
  const sessionCookies = loginResponse.headers.get('set-cookie') || '';
  const allCookies = [setCookies, sessionCookies]
    .filter(Boolean)
    .join(', ')
    .split(',')
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  // Check if login was successful (usually redirects to dashboard)
  if (loginResponse.status === 302 || loginResponse.status === 301) {
    const location = loginResponse.headers.get('location');
    console.log('Login redirect to:', location);
    
    if (location?.includes('dashboard') || location?.includes('user')) {
      cachedSession = {
        cookies: allCookies,
        csrfToken: csrfToken || undefined,
        expiresAt: Date.now() + (60 * 60 * 1000),
      };
      console.log('Login successful!');
      return cachedSession;
    }
  }

  // Try to check if we're actually logged in by accessing dashboard
  const dashboardResponse = await fetch(`${KRIPICARD_BASE_URL}/user/dashboard`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': allCookies,
    },
    redirect: 'manual',
  });

  if (dashboardResponse.status === 200) {
    cachedSession = {
      cookies: allCookies,
      csrfToken: csrfToken || undefined,
      expiresAt: Date.now() + (60 * 60 * 1000),
    };
    console.log('Login verified via dashboard access');
    return cachedSession;
  }

  throw new Error('Login failed - could not access dashboard');
}

/**
 * Get current Kripicard account balance
 */
export async function getKripicardBalance(): Promise<KripicardBalance> {
  const session = await loginToKripicard();

  const response = await fetch(`${KRIPICARD_BASE_URL}/user/dashboard`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': session.cookies,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get dashboard: ${response.status}`);
  }

  const html = await response.text();

  // Parse balance from dashboard HTML - look for common patterns
  const balancePatterns = [
    /balance[^>]*>\s*\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)\s*USD/i,
    /USD\s*:\s*\$?([\d,]+\.?\d*)/i,
    /available[^>]*>\s*\$?([\d,]+\.?\d*)/i,
  ];

  let balance = 0;
  for (const pattern of balancePatterns) {
    const match = html.match(pattern);
    if (match) {
      balance = parseFloat(match[1].replace(',', ''));
      break;
    }
  }

  return {
    available: balance,
    pending: 0,
    currency: 'USD',
  };
}

/**
 * Initiate a deposit - this redirects to Cryptomus
 * Returns the Cryptomus payment URL
 */
// Currency value mapping - form uses ticker codes like SOL, BTC, ETH
const CURRENCY_VALUES: Record<string, string> = {
  'Solana': 'SOL',
  'Bitcoin': 'BTC', 
  'Ethereum': 'ETH',
  'Litecoin': 'LTC',
  'Tron': 'TRX',
  'Binance Coin': 'BNB',
  'Dogecoin': 'DOGE',
  'Toncoin': 'TON',
  'Monero': 'XMR',
  'USDT': 'USDT',
  // Allow passing ticker directly
  'SOL': 'SOL',
  'BTC': 'BTC',
  'ETH': 'ETH',
  'LTC': 'LTC',
  'TRX': 'TRX',
  'BNB': 'BNB',
  'DOGE': 'DOGE',
  'TON': 'TON',
  'XMR': 'XMR',
};

export async function initiateDeposit(amount: number, currency: string = 'SOL'): Promise<DepositInfo> {
  // Convert to form value
  const currencyValue = CURRENCY_VALUES[currency] || currency;
  const session = await loginToKripicard();

  console.log('=== INITIATING KRIPICARD DEPOSIT ===');
  console.log('Amount:', amount, 'Currency:', currency);

  // Step 1: Go to deposit page to get CSRF token
  const depositPageResponse = await fetch(`${KRIPICARD_BASE_URL}/user/usdt-address`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': session.cookies,
    },
  });

  if (!depositPageResponse.ok) {
    throw new Error(`Failed to load deposit page: ${depositPageResponse.status}`);
  }

  const depositPageHtml = await depositPageResponse.text();
  
  // Extract CSRF token from deposit page
  const csrfMatch = depositPageHtml.match(/name="_token"\s+value="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : session.csrfToken;
  
  console.log('Deposit page CSRF:', csrfToken ? 'Found' : 'Not found');

  // Extract form field names from the HTML
  const selectMatch = depositPageHtml.match(/<select[^>]*name="([^"]+)"[^>]*>/i);
  const inputMatch = depositPageHtml.match(/<input[^>]*name="amount"[^>]*>/i);
  const selectName = selectMatch ? selectMatch[1] : 'currency';
  
  console.log('Form structure - select field name:', selectName);
  console.log('Looking for form action...');
  
  // Look for option values in the select
  const optionMatches = depositPageHtml.match(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</gi);
  if (optionMatches) {
    console.log('Found options:', optionMatches.slice(0, 5));
  }
  
  // Step 2: Submit deposit form - this should redirect to Cryptomus
  const formData = new URLSearchParams();
  formData.append('amount', amount.toString());
  formData.append(selectName, currencyValue);
  if (csrfToken) {
    formData.append('_token', csrfToken);
  }
  
  console.log('Form data:', formData.toString());

  // Try different possible form action URLs
  const possibleUrls = [
    `${KRIPICARD_BASE_URL}/user/usdt-address`,
    `${KRIPICARD_BASE_URL}/user/deposit/confirm`,
    `${KRIPICARD_BASE_URL}/user/deposit`,
  ];

  let cryptomusUrl: string | null = null;
  let responseHtml = '';

  for (const url of possibleUrls) {
    console.log('Trying deposit URL:', url);
    
    const depositResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': session.cookies,
        'Referer': `${KRIPICARD_BASE_URL}/user/usdt-address`,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    console.log('Response status:', depositResponse.status);
    
    // Check for redirect to Cryptomus
    if (depositResponse.status === 302 || depositResponse.status === 301) {
      const location = depositResponse.headers.get('location');
      console.log('Redirect location:', location);
      
      if (location?.includes('cryptomus.com') || location?.includes('pay.')) {
        cryptomusUrl = location;
        break;
      }
    }

    // Check response body for Cryptomus URL
    responseHtml = await depositResponse.text();
    
    // Look for Cryptomus payment URL in response
    const cryptomusMatch = responseHtml.match(/https?:\/\/pay\.cryptomus\.com\/pay\/([a-f0-9-]+)/i);
    if (cryptomusMatch) {
      cryptomusUrl = cryptomusMatch[0];
      break;
    }
    
    // Also look for any redirect or payment URL
    const paymentUrlMatch = responseHtml.match(/(?:window\.location|href)\s*=\s*["']([^"']*cryptomus[^"']*)/i);
    if (paymentUrlMatch) {
      cryptomusUrl = paymentUrlMatch[1];
      break;
    }
  }

  if (!cryptomusUrl) {
    // Log what we got for debugging
    console.log('=== DEPOSIT RESPONSE (first 3000 chars) ===');
    console.log(responseHtml.substring(0, 3000));
    throw new Error('Could not get Cryptomus payment URL. Check server logs.');
  }

  // Extract UUID from Cryptomus URL
  const uuidMatch = cryptomusUrl.match(/pay\/([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1] : '';

  console.log('Cryptomus URL:', cryptomusUrl);
  console.log('Payment UUID:', uuid);

  return {
    cryptomusUrl,
    cryptomusUuid: uuid,
    amount,
    currency,
  };
}

/**
 * Get deposit address from Cryptomus payment page
 */
export async function getCryptomusDepositAddress(
  cryptomusUrl: string,
  network: 'SOL' | 'BSC' | 'ETH' | 'TRX' = 'SOL'
): Promise<{ address: string; network: string }> {
  console.log('=== GETTING CRYPTOMUS DEPOSIT ADDRESS ===');
  console.log('URL:', cryptomusUrl, 'Network:', network);

  // Fetch the Cryptomus payment page
  const response = await fetch(cryptomusUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Cryptomus page: ${response.status}`);
  }

  const html = await response.text();

  // The Cryptomus page is a React app, so address might be loaded dynamically
  // We might need to use Cryptomus API instead
  
  // Extract payment UUID from URL
  const uuidMatch = cryptomusUrl.match(/pay\/([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1] : '';

  if (!uuid) {
    throw new Error('Could not extract payment UUID from URL');
  }

  // Try Cryptomus API to get payment details
  // Note: This might require API access
  const apiResponse = await fetch(`https://api.cryptomus.com/v1/payment/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uuid }),
  });

  if (apiResponse.ok) {
    const data = await apiResponse.json();
    if (data.result?.address) {
      return {
        address: data.result.address,
        network: data.result.network || network,
      };
    }
  }

  // Fallback: Try to extract from HTML
  const addressPatterns = [
    /address[^>]*>([1-9A-HJ-NP-Za-km-z]{32,44})</i, // Solana
    /0x[a-fA-F0-9]{40}/i, // ETH/BSC
    /T[A-Za-z1-9]{33}/i, // TRX
  ];

  for (const pattern of addressPatterns) {
    const match = html.match(pattern);
    if (match) {
      return {
        address: match[1] || match[0],
        network,
      };
    }
  }

  console.log('=== CRYPTOMUS PAGE HTML (first 2000 chars) ===');
  console.log(html.substring(0, 2000));
  
  throw new Error('Could not extract deposit address from Cryptomus');
}

/**
 * Clear cached session (for re-login)
 */
export function clearSession(): void {
  cachedSession = null;
}
