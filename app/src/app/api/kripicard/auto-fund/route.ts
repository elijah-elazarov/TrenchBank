import { NextRequest, NextResponse } from 'next/server';
import { initiateKripicardDeposit, getDepositAddressFromCryptomus } from '@/lib/kripicard-browser-automation';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { addPendingDeposit, markDepositAsSent, getDepositSummary } from '@/lib/pending-deposits';

// Supported currencies and their mappings
const CURRENCY_MAP: Record<string, string> = {
  'SOL': 'SOL',
  'SOLANA': 'SOL',
  'BTC': 'BTC',
  'BITCOIN': 'BTC',
  'ETH': 'ETH',
  'ETHEREUM': 'ETH',
  'USDT': 'USDT',
  'TRX': 'TRX',
  'TRON': 'TRX',
};

async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana?.usd || 180;
  } catch {
    return 180; // Fallback price
  }
}

async function sendSolPayment(destinationAddress: string, amountSol: number): Promise<string> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY_SOLANA;
  if (!privateKey) {
    throw new Error('Treasury private key not configured');
  }

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const destinationPubkey = new PublicKey(destinationAddress);

  // Check treasury balance
  const balance = await connection.getBalance(treasuryKeypair.publicKey);
  const requiredLamports = Math.ceil(amountSol * LAMPORTS_PER_SOL);
  const feeBuffer = 10000; // 0.00001 SOL for fees

  if (balance < requiredLamports + feeBuffer) {
    throw new Error(`Insufficient treasury balance. Have: ${balance / LAMPORTS_PER_SOL} SOL, Need: ${amountSol} SOL`);
  }

  // Create and send transaction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: destinationPubkey,
      lamports: requiredLamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);
  return signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, chain = 'SOL', autoSend = false } = body;

    if (!amount || amount < 20) {
      return NextResponse.json(
        { success: false, message: 'Amount must be at least $20' },
        { status: 400 }
      );
    }

    // Normalize currency
    const currency = CURRENCY_MAP[chain.toUpperCase()] || chain.toUpperCase();
    
    // Currently only SOL is fully supported for auto-send
    if (autoSend && currency !== 'SOL') {
      return NextResponse.json(
        { success: false, message: 'Auto-send currently only supports SOL' },
        { status: 400 }
      );
    }

    console.log(`Initiating Kripicard deposit: $${amount} via ${currency}`);

    // Step 1: Use browser automation to initiate deposit
    const depositResult = await initiateKripicardDeposit(amount, currency);

    if (!depositResult.success) {
      return NextResponse.json(
        { success: false, message: depositResult.error || 'Failed to initiate deposit' },
        { status: 500 }
      );
    }

    console.log('Deposit initiated:', depositResult);

    // Step 2: If we got the Cryptomus URL but no address, try to extract it
    let depositAddress = depositResult.depositAddress;
    if (!depositAddress && depositResult.cryptomusUrl) {
      depositAddress = await getDepositAddressFromCryptomus(depositResult.cryptomusUrl) || undefined;
    }

    // Track deposit in file database
    const paymentId = depositResult.paymentId || crypto.randomUUID();
    const pendingDeposit = addPendingDeposit({
      paymentId,
      amountUsd: amount,
      amountCrypto: depositResult.amount ? `${depositResult.amount} ${currency}` : undefined,
      currency,
      depositAddress,
      cryptomusUrl: depositResult.cryptomusUrl,
    });

    if (!depositAddress) {
      return NextResponse.json({
        success: true,
        message: 'Deposit initiated but could not extract address automatically',
        cryptomusUrl: depositResult.cryptomusUrl,
        paymentId,
        depositId: pendingDeposit.id,
        manualPaymentRequired: true,
      });
    }

    // Step 3: If autoSend is enabled and we have an address, send the payment
    if (autoSend && depositAddress && currency === 'SOL') {
      const solPrice = await getSolPrice();
      const solAmount = parseFloat(depositResult.amount || '0') || (amount / solPrice);

      console.log(`Sending ${solAmount} SOL to ${depositAddress}`);

      try {
        const txSignature = await sendSolPayment(depositAddress, solAmount);
        
        // Update deposit status
        markDepositAsSent(paymentId, txSignature);
        
        return NextResponse.json({
          success: true,
          message: 'Deposit sent successfully',
          depositAddress,
          amount: solAmount,
          currency: 'SOL',
          transactionSignature: txSignature,
          cryptomusUrl: depositResult.cryptomusUrl,
          paymentId,
          depositId: pendingDeposit.id,
        });
      } catch (sendError) {
        return NextResponse.json({
          success: false,
          message: `Failed to send payment: ${sendError}`,
          depositAddress,
          cryptomusUrl: depositResult.cryptomusUrl,
          paymentId,
        }, { status: 500 });
      }
    }

    // Return deposit info for manual payment
    return NextResponse.json({
      success: true,
      message: 'Deposit initiated',
      depositAddress,
      amount: depositResult.amount,
      currency: depositResult.currency,
      network: depositResult.network,
      cryptomusUrl: depositResult.cryptomusUrl,
      paymentId,
      depositId: pendingDeposit.id,
    });

  } catch (error) {
    console.error('Auto-fund error:', error);
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const summary = getDepositSummary();
  
  return NextResponse.json({
    message: 'Kripicard Auto-Fund API',
    depositSummary: summary,
    usage: {
      method: 'POST',
      body: {
        amount: 'number (USD amount, min $20)',
        chain: 'string (SOL, BTC, ETH, etc.)',
        autoSend: 'boolean (auto-send from treasury wallet)',
      },
    },
    webhookUrl: '/api/kripicard/webhook',
    checkStatusUrl: '/api/kripicard/webhook?paymentId=<PAYMENT_ID>',
  });
}
