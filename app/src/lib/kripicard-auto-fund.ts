/**
 * Kripicard Auto-Funding System
 * 
 * Complete automation flow:
 * 1. Login to Kripicard
 * 2. Initiate deposit with correct chain
 * 3. Follow redirect to Cryptomus
 * 4. Get deposit address
 * 5. Send payment from treasury wallet
 * 6. Wait for confirmation
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const KRIPICARD_BASE_URL = 'https://kripicard.com';

// Supported chains and their treasury config
type SupportedChain = 'SOL' | 'USDT' | 'ETH' | 'BTC' | 'TRX' | 'BNB';

interface FundingResult {
  success: boolean;
  message: string;
  chain?: string;
  depositAddress?: string;
  txSignature?: string;
  amountSent?: number;
  cryptomusUuid?: string;
}

interface KripicardSession {
  cookies: string;
  csrfToken?: string;
}

// ============ KRIPICARD LOGIN ============

async function loginToKripicard(): Promise<KripicardSession> {
  const username = process.env.KRIPICARD_USERNAME;
  const password = process.env.KRIPICARD_PASSWORD;

  if (!username || !password) {
    throw new Error('Kripicard credentials not configured (KRIPICARD_USERNAME, KRIPICARD_PASSWORD)');
  }

  console.log('=== LOGGING INTO KRIPICARD ===');

  // Get login page for CSRF token
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

  // Submit login
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  if (csrfToken) formData.append('_token', csrfToken);

  const loginResponse = await fetch(`${KRIPICARD_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': parseCookies(initialCookies),
      'Referer': `${KRIPICARD_BASE_URL}/login`,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  const sessionCookies = loginResponse.headers.get('set-cookie') || '';
  const allCookies = mergeCookies(initialCookies, sessionCookies);

  // Verify login by accessing dashboard
  const dashResponse = await fetch(`${KRIPICARD_BASE_URL}/user/dashboard`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Cookie': allCookies,
    },
    redirect: 'manual',
  });

  if (dashResponse.status !== 200 && dashResponse.status !== 302) {
    throw new Error('Login failed - could not access dashboard');
  }

  console.log('Login successful');
  return { cookies: allCookies, csrfToken };
}

function parseCookies(cookieHeader: string): string {
  return cookieHeader
    .split(',')
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function mergeCookies(...headers: string[]): string {
  const cookies = new Map<string, string>();
  for (const header of headers) {
    const parts = header.split(',');
    for (const part of parts) {
      const [nameValue] = part.split(';');
      if (nameValue) {
        const [name, value] = nameValue.split('=');
        if (name && value) {
          cookies.set(name.trim(), value.trim());
        }
      }
    }
  }
  return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ============ INITIATE DEPOSIT ============

async function initiateKripicardDeposit(
  session: KripicardSession,
  amount: number,
  chain: SupportedChain
): Promise<{ cryptomusUrl: string; uuid: string }> {
  console.log(`=== INITIATING DEPOSIT: $${amount} via ${chain} ===`);

  // Get deposit page for fresh CSRF token
  const depositPageResponse = await fetch(`${KRIPICARD_BASE_URL}/user/usdt-address`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Cookie': session.cookies,
    },
  });

  const depositPageHtml = await depositPageResponse.text();
  const csrfMatch = depositPageHtml.match(/name="_token"\s+value="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : session.csrfToken || '';

  // Map chain to Kripicard currency value - try the full name as shown in dropdown
  const currencyMap: Record<SupportedChain, string> = {
    'SOL': 'Solana',
    'USDT': 'USDT',
    'ETH': 'Ethereum',
    'BTC': 'Bitcoin',
    'TRX': 'Tron',
    'BNB': 'Binance Coin',
  };

  // Submit deposit form - try to find the actual form field name
  const formData = new URLSearchParams();
  formData.append('amount', amount.toString());
  formData.append('currency', currencyMap[chain]);
  if (csrfToken) formData.append('_token', csrfToken);
  
  console.log('Form data being submitted:', formData.toString());

  const depositResponse = await fetch(`${KRIPICARD_BASE_URL}/user/usdt-address`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'Referer': `${KRIPICARD_BASE_URL}/user/usdt-address`,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  console.log('Deposit form response status:', depositResponse.status);
  console.log('Deposit form headers:', Object.fromEntries(depositResponse.headers.entries()));

  // Check for redirect to Cryptomus
  let cryptomusUrl = '';
  const responseHtml = await depositResponse.text();
  console.log('Deposit response length:', responseHtml.length);
  console.log('Deposit response preview:', responseHtml.substring(0, 500));
  
  if (depositResponse.status === 302 || depositResponse.status === 301) {
    const location = depositResponse.headers.get('location');
    console.log('Redirect location:', location);
    
    if (location?.includes('cryptomus') || location?.includes('pay.')) {
      cryptomusUrl = location;
    } else if (location) {
      // Follow the redirect
      const redirectResponse = await fetch(location.startsWith('http') ? location : `${KRIPICARD_BASE_URL}${location}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': session.cookies,
        },
        redirect: 'manual',
      });
      
      console.log('Redirect response status:', redirectResponse.status);
      const redirectHtml = await redirectResponse.text();
      console.log('Redirect response preview:', redirectHtml.substring(0, 500));
      
      const nextLocation = redirectResponse.headers.get('location');
      if (nextLocation?.includes('cryptomus') || nextLocation?.includes('pay.')) {
        cryptomusUrl = nextLocation;
      }
      
      // Check redirect body for Cryptomus URL
      const cryptomusInRedirect = redirectHtml.match(/https?:\/\/pay\.cryptomus\.com\/pay\/([a-f0-9-]+)/i);
      if (cryptomusInRedirect) {
        cryptomusUrl = cryptomusInRedirect[0];
      }
    }
  }

  // Check response body for Cryptomus URL
  if (!cryptomusUrl) {
    const cryptomusMatch = responseHtml.match(/https?:\/\/pay\.cryptomus\.com\/pay\/([a-f0-9-]+)/i);
    if (cryptomusMatch) {
      cryptomusUrl = cryptomusMatch[0];
    }
    
    // Also check for JavaScript redirect
    const jsRedirectMatch = responseHtml.match(/window\.location\s*=\s*["']([^"']*cryptomus[^"']*)/i);
    if (jsRedirectMatch) {
      cryptomusUrl = jsRedirectMatch[1];
    }
    
    // Check for meta refresh redirect
    const metaRedirectMatch = responseHtml.match(/meta[^>]*http-equiv=["']refresh["'][^>]*url=([^"'\s>]+)/i);
    if (metaRedirectMatch) {
      console.log('Meta redirect found:', metaRedirectMatch[1]);
      if (metaRedirectMatch[1].includes('cryptomus')) {
        cryptomusUrl = metaRedirectMatch[1];
      }
    }
  }

  if (!cryptomusUrl) {
    throw new Error('Could not get Cryptomus payment URL from Kripicard');
  }

  // Extract UUID from URL
  const uuidMatch = cryptomusUrl.match(/pay\/([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1] : '';

  console.log('Cryptomus URL:', cryptomusUrl);
  console.log('Payment UUID:', uuid);

  return { cryptomusUrl, uuid };
}

// ============ GET CRYPTOMUS DEPOSIT ADDRESS ============

async function getCryptomusDepositAddress(
  cryptomusUrl: string,
  chain: SupportedChain
): Promise<{ address: string; network: string; amount: number }> {
  console.log(`=== GETTING CRYPTOMUS DEPOSIT ADDRESS for ${chain} ===`);

  // Extract UUID
  const uuidMatch = cryptomusUrl.match(/pay\/([a-f0-9-]+)/i);
  const uuid = uuidMatch ? uuidMatch[1] : '';

  if (!uuid) {
    throw new Error('Invalid Cryptomus URL - no UUID found');
  }

  // Map our chain to Cryptomus network names
  const networkMap: Record<SupportedChain, string> = {
    'SOL': 'SOL',
    'USDT': 'trc20', // Default to TRC20 for USDT
    'ETH': 'eth',
    'BTC': 'btc',
    'TRX': 'tron',
    'BNB': 'bsc',
  };

  // Try to get payment info from Cryptomus
  // First, load the payment page to see available networks
  const paymentPageResponse = await fetch(cryptomusUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const paymentHtml = await paymentPageResponse.text();
  
  // Look for the payment amount
  const amountMatch = paymentHtml.match(/(\d+(?:\.\d+)?)\s*(?:USDT|USD|SOL)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  // The Cryptomus page is a React SPA, so we need to use their API
  // Try the payment info endpoint
  const networkName = networkMap[chain];
  
  // Cryptomus uses a specific API structure - let's try to get payment details
  const apiResponse = await fetch('https://api.cryptomus.com/v1/payment/info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uuid }),
  });

  if (apiResponse.ok) {
    const apiData = await apiResponse.json();
    if (apiData.result?.address) {
      return {
        address: apiData.result.address,
        network: apiData.result.network || networkName,
        amount: parseFloat(apiData.result.payer_amount || amount.toString()),
      };
    }
  }

  // If API doesn't work, try to select network and get address via form
  // This requires JavaScript interaction which is complex via fetch
  // For now, we'll use a workaround - check if there's address in HTML
  
  // Look for Solana address pattern in the HTML
  const solAddressMatch = paymentHtml.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g);
  if (solAddressMatch && chain === 'SOL') {
    // Filter out common non-address strings
    const validAddresses = solAddressMatch.filter(addr => 
      addr.length >= 32 && 
      addr.length <= 44 &&
      !addr.match(/^[A-Za-z]+$/) // Not all letters
    );
    
    if (validAddresses.length > 0) {
      return {
        address: validAddresses[0],
        network: 'SOL',
        amount,
      };
    }
  }

  throw new Error(`Could not get deposit address for ${chain} from Cryptomus. The payment page may require JavaScript interaction.`);
}

// ============ SEND SOL PAYMENT ============

async function sendSolPayment(
  toAddress: string,
  amountSol: number,
  memo?: string
): Promise<string> {
  console.log(`=== SENDING ${amountSol} SOL to ${toAddress} ===`);

  const privateKey = process.env.TREASURY_PRIVATE_KEY_SOLANA;
  if (!privateKey) {
    throw new Error('Treasury wallet not configured (TREASURY_PRIVATE_KEY_SOLANA)');
  }

  // Decode private key
  let treasuryKeypair: Keypair;
  try {
    treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch {
    try {
      treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
    } catch {
      throw new Error('Invalid treasury private key format');
    }
  }

  console.log('Treasury wallet:', treasuryKeypair.publicKey.toString());

  // Connect to Solana
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(treasuryKeypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log('Treasury balance:', balanceSol, 'SOL');

  const requiredSol = amountSol + 0.001; // Add fee buffer
  if (balanceSol < requiredSol) {
    throw new Error(`Insufficient treasury balance. Have ${balanceSol.toFixed(4)} SOL, need ${requiredSol.toFixed(4)} SOL`);
  }

  // Build transaction
  const toPublicKey = new PublicKey(toAddress);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction();
  
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports,
    })
  );

  // Add memo if provided
  if (memo) {
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    transaction.add({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, 'utf-8'),
    });
  }

  // Send transaction
  const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
    commitment: 'confirmed',
  });

  console.log('Transaction signature:', signature);
  return signature;
}

// ============ GET SOL PRICE ============

async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana?.usd || 185;
  } catch {
    return 185; // Fallback
  }
}

// ============ WAIT FOR CRYPTOMUS CONFIRMATION ============

async function waitForCryptomusConfirmation(
  uuid: string,
  maxWaitMs: number = 5 * 60 * 1000,
  pollIntervalMs: number = 10 * 1000
): Promise<boolean> {
  console.log('=== WAITING FOR CRYPTOMUS CONFIRMATION ===');
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch('https://api.cryptomus.com/v1/payment/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });

      if (response.ok) {
        const data = await response.json();
        const status = data.result?.status;
        console.log('Payment status:', status);

        if (status === 'paid' || status === 'paid_over') {
          console.log('Payment confirmed!');
          return true;
        }

        if (status === 'fail' || status === 'cancel' || status === 'wrong_amount') {
          console.log('Payment failed:', status);
          return false;
        }
      }
    } catch (error) {
      console.warn('Error checking payment status:', error);
    }

    console.log(`Waiting ${pollIntervalMs / 1000}s before next check...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.log('Timeout waiting for confirmation');
  return false;
}

// ============ MAIN AUTO-FUND FUNCTION ============

export async function autoFundKripicard(
  amountUsd: number,
  chain: SupportedChain = 'SOL'
): Promise<FundingResult> {
  console.log('========================================');
  console.log(`AUTO-FUND KRIPICARD: $${amountUsd} via ${chain}`);
  console.log('========================================');

  try {
    // Step 1: Login to Kripicard
    const session = await loginToKripicard();

    // Step 2: Initiate deposit
    const { cryptomusUrl, uuid } = await initiateKripicardDeposit(session, amountUsd, chain);

    // Step 3: Get deposit address from Cryptomus
    let depositAddress: string;
    let cryptoAmount: number;

    if (chain === 'SOL') {
      // For SOL, we need to get the address and calculate amount
      const solPrice = await getSolPrice();
      cryptoAmount = (amountUsd / solPrice) * 1.02; // 2% buffer for price fluctuation
      
      try {
        const depositInfo = await getCryptomusDepositAddress(cryptomusUrl, chain);
        depositAddress = depositInfo.address;
        if (depositInfo.amount > 0) {
          cryptoAmount = depositInfo.amount;
        }
      } catch (error) {
        console.warn('Could not auto-get address, returning URL for manual completion');
        return {
          success: false,
          message: `Deposit initiated but could not get address automatically. Complete payment at: ${cryptomusUrl}`,
          chain,
          cryptomusUuid: uuid,
        };
      }

      // Step 4: Send SOL payment
      console.log(`Sending ${cryptoAmount.toFixed(6)} SOL to ${depositAddress}`);
      const txSignature = await sendSolPayment(depositAddress, cryptoAmount, uuid);

      // Step 5: Wait for confirmation
      const confirmed = await waitForCryptomusConfirmation(uuid, 5 * 60 * 1000, 15 * 1000);

      if (confirmed) {
        return {
          success: true,
          message: `Successfully funded Kripicard with $${amountUsd} via SOL`,
          chain,
          depositAddress,
          txSignature,
          amountSent: cryptoAmount,
          cryptomusUuid: uuid,
        };
      } else {
        return {
          success: false,
          message: 'Payment sent but confirmation timeout. Check Kripicard balance manually.',
          chain,
          depositAddress,
          txSignature,
          amountSent: cryptoAmount,
          cryptomusUuid: uuid,
        };
      }
    } else {
      // For other chains, return the URL for manual completion
      return {
        success: false,
        message: `Deposit initiated for ${chain}. Complete payment at: ${cryptomusUrl}`,
        chain,
        cryptomusUuid: uuid,
      };
    }
  } catch (error) {
    console.error('Auto-fund error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Auto-fund failed',
      chain,
    };
  }
}

// ============ CREATE CARD AFTER FUNDING ============

export async function fundAndCreateCard(
  cardAmountUsd: number,
  fundingChain: SupportedChain = 'SOL'
): Promise<{
  success: boolean;
  message: string;
  cardId?: string;
  fundingTx?: string;
}> {
  console.log('========================================');
  console.log(`FUND AND CREATE CARD: $${cardAmountUsd}`);
  console.log('========================================');

  // Add buffer for fees (Kripicard takes fees on top)
  const fundingAmount = cardAmountUsd * 1.15; // 15% buffer

  // Step 1: Fund Kripicard
  const fundResult = await autoFundKripicard(fundingAmount, fundingChain);
  
  if (!fundResult.success) {
    return {
      success: false,
      message: fundResult.message,
      fundingTx: fundResult.txSignature,
    };
  }

  // Wait a bit for Kripicard to process the deposit
  console.log('Waiting 30s for Kripicard to process deposit...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Step 2: Create card
  const apiKey = process.env.KRIPICARD_API_KEY;
  const bankBin = process.env.KRIPICARD_BANK_BIN;

  const createResponse = await fetch('https://kripicard.com/api/premium/Create_card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      amount: cardAmountUsd,
      bankBin: Number(bankBin),
    }),
  });

  const createData = await createResponse.json();

  if (!createData.success) {
    return {
      success: false,
      message: createData.message || 'Card creation failed after funding',
      fundingTx: fundResult.txSignature,
    };
  }

  return {
    success: true,
    message: `Card created successfully with $${cardAmountUsd}`,
    cardId: createData.card_id,
    fundingTx: fundResult.txSignature,
  };
}

