import puppeteer, { Browser, Page } from 'puppeteer';

const KRIPICARD_BASE_URL = 'https://kripicard.com';

interface DepositResult {
  success: boolean;
  cryptomusUrl?: string;
  depositAddress?: string;
  amount?: string;
  currency?: string;
  network?: string;
  paymentId?: string;
  error?: string;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function initiateKripicardDeposit(
  amount: number,
  currency: string = 'SOL'
): Promise<DepositResult> {
  const username = process.env.KRIPICARD_USERNAME;
  const password = process.env.KRIPICARD_PASSWORD;

  if (!username || !password) {
    return { success: false, error: 'Kripicard credentials not configured' };
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('Step 1: Navigating to login page...');
    await page.goto(`${KRIPICARD_BASE_URL}/login`, { waitUntil: 'networkidle2' });

    // Check if already logged in (redirected to dashboard)
    let currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);
    
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/user/')) {
      console.log('Already logged in, skipping login...');
    } else {
      // Fill login form
      console.log('Step 2: Filling login form...');
      
      // Wait for form to be ready
      try {
        await page.waitForSelector('input[type="email"], input[name="email"], input[name="username"]', { timeout: 5000 });
        
        // Find and fill email/username field
        const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('input[name="username"]');
        if (emailInput) {
          await emailInput.type(username);
        }
        
        // Find and fill password field
        const passwordInput = await page.$('input[type="password"]') || await page.$('input[name="password"]');
        if (passwordInput) {
          await passwordInput.type(password);
        }

        // Click login button - find it using evaluate
        console.log('Step 3: Clicking login button...');
        const loginClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const loginBtn = buttons.find(b => 
            b.textContent?.toLowerCase().includes('login') ||
            b.textContent?.toLowerCase().includes('sign in') ||
            (b as HTMLInputElement).value?.toLowerCase().includes('login')
          );
          if (loginBtn) {
            (loginBtn as HTMLElement).click();
            return true;
          }
          // Try form submit
          const form = document.querySelector('form');
          if (form) {
            form.submit();
            return true;
          }
          return false;
        });
        
        if (loginClicked) {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        }

        // Check if login was successful
        currentUrl = page.url();
        console.log('After login URL:', currentUrl);
        
        if (currentUrl.includes('/login')) {
          return { success: false, error: 'Login failed - still on login page' };
        }
      } catch (e) {
        // Login form not found, might already be logged in
        console.log('Login form not found, checking if already logged in...');
        currentUrl = page.url();
        if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/user/')) {
          return { success: false, error: 'Could not find login form or dashboard' };
        }
      }
    }

    // Navigate to deposit page
    console.log('Step 3: Navigating to deposit page...');
    await page.goto(`${KRIPICARD_BASE_URL}/user/usdt-address`, { waitUntil: 'networkidle2' });

    // Fill amount
    console.log('Step 4: Filling deposit form...');
    const amountInput = await page.$('input[name="amount"], input[type="number"]');
    if (amountInput) {
      await amountInput.click({ clickCount: 3 }); // Select all
      await amountInput.type(amount.toString());
    }

    // Select currency
    console.log('Step 5: Selecting currency:', currency);
    const currencySelect = await page.$('select[name="currency"], select');
    if (currencySelect) {
      await page.select('select[name="currency"], select', currency);
    }

    // Click proceed button
    console.log('Step 6: Clicking proceed button...');
    
    // Wait for any loading to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find and click the submit button
    const submitButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => 
        b.textContent?.toLowerCase().includes('proceed') ||
        b.textContent?.toLowerCase().includes('cryptomus') ||
        b.textContent?.toLowerCase().includes('submit') ||
        b.textContent?.toLowerCase().includes('deposit')
      ) || null;
    });

    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        (submitButton as any).click(),
      ]);
    }

    // Wait for redirect to Cryptomus
    console.log('Step 7: Waiting for Cryptomus redirect...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    if (finalUrl.includes('cryptomus.com') || finalUrl.includes('pay.')) {
      // Extract payment ID from URL
      const paymentIdMatch = finalUrl.match(/\/pay\/([a-f0-9-]+)/i);
      const paymentId = paymentIdMatch ? paymentIdMatch[1] : undefined;

      // Wait for page to load fully
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract deposit address from the page
      console.log('Step 8: Extracting deposit address...');
      
      const depositInfo = await page.evaluate(() => {
        // Try to find the wallet address
        const addressElements = document.querySelectorAll('[class*="address"], [class*="wallet"]');
        let address = '';
        
        // Look for Solana address pattern (base58, 32-44 chars)
        const allText = document.body.innerText;
        const solanaAddressMatch = allText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
        if (solanaAddressMatch) {
          // Find the one that looks like a Solana address (starts with common prefixes)
          address = solanaAddressMatch.find(a => 
            a.length >= 32 && a.length <= 44
          ) || '';
        }

        // Get amount
        const amountMatch = allText.match(/(\d+\.?\d*)\s*(SOL|BTC|ETH|USDT)/i);
        const amount = amountMatch ? amountMatch[1] : '';
        const currency = amountMatch ? amountMatch[2] : '';

        return { address, amount, currency };
      });

      return {
        success: true,
        cryptomusUrl: finalUrl,
        depositAddress: depositInfo.address,
        amount: depositInfo.amount,
        currency: depositInfo.currency,
        network: currency,
        paymentId,
      };
    }

    // Check if we're still on Kripicard with an error
    const pageContent = await page.content();
    if (pageContent.includes('error') || pageContent.includes('Error')) {
      const errorText = await page.evaluate(() => {
        const errorEl = document.querySelector('.error, .alert-danger, [class*="error"]');
        return errorEl?.textContent || '';
      });
      return { success: false, error: `Form submission failed: ${errorText}` };
    }

    return { success: false, error: 'Did not redirect to Cryptomus payment page' };

  } catch (error) {
    console.error('Browser automation error:', error);
    return { success: false, error: String(error) };
  } finally {
    await page.close();
  }
}

export async function getDepositAddressFromCryptomus(paymentUrl: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    await page.goto(paymentUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract the deposit address
    const address = await page.evaluate(() => {
      // Look for the wallet address in the page
      const allText = document.body.innerText;
      
      // Solana addresses are base58 encoded, 32-44 characters
      const addresses = allText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
      
      // Filter to likely deposit addresses (not common words)
      const validAddresses = addresses.filter(addr => 
        addr.length >= 32 && 
        addr.length <= 44 &&
        !addr.includes('0') &&
        !addr.includes('O') &&
        !addr.includes('I') &&
        !addr.includes('l')
      );

      return validAddresses[0] || null;
    });

    return address;
  } catch (error) {
    console.error('Error extracting address:', error);
    return null;
  } finally {
    await page.close();
  }
}

