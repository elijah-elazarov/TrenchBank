import { NextRequest, NextResponse } from 'next/server';
import { 
  CryptoCurrency, 
  CryptoNetwork, 
  generateDepositReference,
  usdToCrypto,
  NETWORK_CONFIG,
} from '@/lib/crypto-deposit';

// Minimum deposit amounts
const MIN_DEPOSIT_USD = 20;

// Get deposit addresses from environment variables
function getDepositAddress(network: CryptoNetwork): string | null {
  if (network === 'solana') {
    return process.env.DEPOSIT_WALLET_SOLANA || null;
  } else if (network === 'ethereum') {
    return process.env.DEPOSIT_WALLET_ETHEREUM || null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, amount, netAmount, currency, network } = body as {
      walletAddress: string;
      amount: number; // Gross amount (what user sends, including fees)
      netAmount?: number; // Net amount (what user receives after fees)
      currency: CryptoCurrency;
      network: CryptoNetwork;
    };

    // Validate wallet address
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate amount - check netAmount if provided, otherwise gross amount
    const amountToValidate = netAmount || amount;
    if (!amountToValidate || amountToValidate < MIN_DEPOSIT_USD) {
      return NextResponse.json(
        { success: false, message: `Minimum amount to receive is $${MIN_DEPOSIT_USD}` },
        { status: 400 }
      );
    }

    // Validate currency
    if (!currency || !['SOL', 'USDT', 'ETH'].includes(currency)) {
      return NextResponse.json(
        { success: false, message: 'Invalid currency. Use SOL, USDT, or ETH' },
        { status: 400 }
      );
    }

    // Validate network
    if (!network || !['solana', 'ethereum'].includes(network)) {
      return NextResponse.json(
        { success: false, message: 'Invalid network. Use solana or ethereum' },
        { status: 400 }
      );
    }

    // Check if currency is valid for network
    if (!NETWORK_CONFIG[network].currencies.includes(currency)) {
      return NextResponse.json(
        { success: false, message: `${currency} is not available on ${network}` },
        { status: 400 }
      );
    }

    // Get deposit address
    const depositAddress = getDepositAddress(network);
    if (!depositAddress) {
      return NextResponse.json(
        { success: false, message: `${network} deposits not configured. Contact support.` },
        { status: 503 }
      );
    }

    // Generate unique reference
    const reference = generateDepositReference();
    
    // Calculate crypto amount
    const cryptoAmount = usdToCrypto(amount, currency);

    // Create deposit request
    const deposit = {
      id: crypto.randomUUID(),
      walletAddress,
      amount, // Gross amount (what user sends)
      netAmount: netAmount || amount, // Net amount (what user receives)
      cryptoAmount,
      currency,
      network,
      depositAddress,
      reference,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };

    console.log('=== CRYPTO DEPOSIT CREATED ===');
    console.log('Deposit ID:', deposit.id);
    console.log('Reference:', reference);
    console.log('Gross Amount:', `$${amount} = ${cryptoAmount} ${currency}`);
    console.log('Net Amount (user receives):', `$${netAmount || amount}`);
    console.log('Network:', network);
    console.log('Deposit Address:', depositAddress);

    return NextResponse.json({
      success: true,
      message: 'Deposit request created',
      data: deposit,
    });
  } catch (error) {
    console.error('Create crypto deposit error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

