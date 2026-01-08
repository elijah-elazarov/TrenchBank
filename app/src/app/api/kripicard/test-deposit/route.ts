import { NextRequest, NextResponse } from 'next/server';

const KRIPICARD_BASE_URL = 'https://kripicard.com';

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const body = await request.json();
    const { amount = 30, currency = 'Solana' } = body;

    const username = process.env.KRIPICARD_USERNAME;
    const password = process.env.KRIPICARD_PASSWORD;

    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Credentials not configured', logs });
    }

    // Step 1: Login
    log('=== STEP 1: LOGIN ===');
    
    const loginPageResponse = await fetch(`${KRIPICARD_BASE_URL}/login`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    
    const loginPageHtml = await loginPageResponse.text();
    const csrfMatch = loginPageHtml.match(/name="_token"\s+value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';
    const initialCookies = loginPageResponse.headers.get('set-cookie') || '';
    
    log(`CSRF token found: ${csrfToken ? 'Yes' : 'No'}`);
    
    const loginFormData = new URLSearchParams();
    loginFormData.append('username', username);
    loginFormData.append('password', password);
    if (csrfToken) loginFormData.append('_token', csrfToken);
    
    const parsedCookies = initialCookies.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    
    const loginResponse = await fetch(`${KRIPICARD_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': parsedCookies,
        'Referer': `${KRIPICARD_BASE_URL}/login`,
      },
      body: loginFormData.toString(),
      redirect: 'manual',
    });
    
    log(`Login response status: ${loginResponse.status}`);
    log(`Login redirect location: ${loginResponse.headers.get('location')}`);
    
    // Properly parse set-cookie headers (they can have multiple values)
    const sessionCookiesRaw = loginResponse.headers.getSetCookie?.() || [];
    log(`Session cookies count: ${sessionCookiesRaw.length}`);
    
    // Combine all cookies
    const cookieMap = new Map<string, string>();
    
    // Parse initial cookies
    initialCookies.split(',').forEach(part => {
      const cookiePart = part.split(';')[0].trim();
      if (cookiePart.includes('=')) {
        const [name, ...valueParts] = cookiePart.split('=');
        cookieMap.set(name.trim(), valueParts.join('='));
      }
    });
    
    // Parse session cookies
    sessionCookiesRaw.forEach(cookie => {
      const cookiePart = cookie.split(';')[0].trim();
      if (cookiePart.includes('=')) {
        const [name, ...valueParts] = cookiePart.split('=');
        cookieMap.set(name.trim(), valueParts.join('='));
      }
    });
    
    const allCookies = Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    log(`Combined cookies: ${allCookies.substring(0, 100)}...`);
    
    // Step 2: Get deposit page
    log('=== STEP 2: GET DEPOSIT PAGE ===');
    
    const depositPageResponse = await fetch(`${KRIPICARD_BASE_URL}/user/usdt-address`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': allCookies,
      },
    });
    
    log(`Deposit page status: ${depositPageResponse.status}`);
    
    const depositPageHtml = await depositPageResponse.text();
    
    // Check if we're redirected to login (session invalid)
    if (depositPageHtml.includes('login') && depositPageHtml.includes('Remember Me')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not logged in - session invalid',
        logs 
      });
    }
    
    // Extract form structure
    const newCsrfMatch = depositPageHtml.match(/name="_token"\s+value="([^"]+)"/);
    const newCsrfToken = newCsrfMatch ? newCsrfMatch[1] : csrfToken;
    
    // Find the form element and its action
    const formMatch = depositPageHtml.match(/<form[^>]*action="([^"]*)"[^>]*method="([^"]*)"[^>]*>/i);
    let formAction = `${KRIPICARD_BASE_URL}/user/usdt-address`;
    let formMethod = 'POST';
    
    if (formMatch) {
      formAction = formMatch[1].startsWith('http') ? formMatch[1] : `${KRIPICARD_BASE_URL}${formMatch[1]}`;
      formMethod = formMatch[2].toUpperCase();
    }
    
    log(`Form action: ${formAction}`);
    log(`Form method: ${formMethod}`);
    
    // Find the select element and its options
    const selectMatch = depositPageHtml.match(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/i);
    let selectName = 'currency';
    let optionValues: { value: string; text: string }[] = [];
    
    if (selectMatch) {
      selectName = selectMatch[1];
      const selectHtml = selectMatch[2];
      const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)</gi;
      let match;
      while ((match = optionRegex.exec(selectHtml)) !== null) {
        optionValues.push({ value: match[1], text: match[2].trim() });
      }
    }
    
    log(`Select field name: ${selectName}`);
    log(`Found ${optionValues.length} options`);
    optionValues.forEach(o => log(`  - value="${o.value}" text="${o.text}"`));
    
    // Find the right option value for the requested currency
    let selectedValue = currency;
    const matchingOption = optionValues.find(o => 
      o.text.toLowerCase() === currency.toLowerCase() ||
      o.value.toLowerCase() === currency.toLowerCase()
    );
    if (matchingOption) {
      selectedValue = matchingOption.value;
      log(`Matched option: value="${selectedValue}" for currency="${currency}"`);
    } else {
      log(`No exact match found, using "${currency}" as-is`);
    }
    
    // Step 3: Submit deposit form
    log('=== STEP 3: SUBMIT DEPOSIT FORM ===');
    
    const formData = new URLSearchParams();
    formData.append('amount', amount.toString());
    formData.append(selectName, selectedValue);
    if (newCsrfToken) formData.append('_token', newCsrfToken);
    
    log(`Form data: ${formData.toString()}`);
    
    const depositResponse = await fetch(formAction, {
      method: formMethod,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': allCookies,
        'Referer': `${KRIPICARD_BASE_URL}/user/usdt-address`,
      },
      body: formData.toString(),
      redirect: 'manual',
    });
    
    log(`Deposit form response status: ${depositResponse.status}`);
    log(`Deposit form headers: ${JSON.stringify(Object.fromEntries(depositResponse.headers.entries()))}`);
    
    // Check for redirect
    if (depositResponse.status === 302 || depositResponse.status === 301) {
      const location = depositResponse.headers.get('location');
      log(`Redirect to: ${location}`);
      
      if (location?.includes('cryptomus') || location?.includes('pay.')) {
        return NextResponse.json({
          success: true,
          message: 'Got Cryptomus redirect!',
          cryptomusUrl: location,
          logs,
        });
      }
    }
    
    // Check response body
    const responseHtml = await depositResponse.text();
    log(`Response length: ${responseHtml.length}`);
    log(`Response preview: ${responseHtml.substring(0, 500)}`);
    
    // Look for Cryptomus URL in body
    const cryptomusMatch = responseHtml.match(/https?:\/\/pay\.cryptomus\.com\/pay\/([a-f0-9-]+)/i);
    if (cryptomusMatch) {
      return NextResponse.json({
        success: true,
        message: 'Found Cryptomus URL in response body!',
        cryptomusUrl: cryptomusMatch[0],
        logs,
      });
    }
    
    // Look for error messages
    const errorMatch = responseHtml.match(/class="[^"]*error[^"]*"[^>]*>([^<]+)</i);
    const alertMatch = responseHtml.match(/class="[^"]*alert[^"]*"[^>]*>([^<]+)</i);
    
    if (errorMatch) {
      log(`Error found: ${errorMatch[1]}`);
    }
    if (alertMatch) {
      log(`Alert found: ${alertMatch[1]}`);
    }
    
    return NextResponse.json({
      success: false,
      message: 'No Cryptomus redirect or URL found',
      logs,
      responsePreview: responseHtml.substring(0, 1000),
    });
    
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      logs,
    }, { status: 500 });
  }
}

