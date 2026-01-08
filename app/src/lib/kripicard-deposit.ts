/**
 * Kripicard Auto-Deposit Flow
 * Handles sending SOL from treasury to Kripicard and waiting for credit
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { initiateDeposit, checkDepositStatus, getKripicardBalance } from './kripicard-dashboard';

interface DepositResult {
  success: boolean;
  message: string;
  txSignature?: string;
  depositAddress?: string;
  reference?: string;
  amountSol?: number;
  amountUsd?: number;
}

/**
 * Get SOL price in USD (uses CoinGecko)
 */
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana?.usd || 180; // Fallback to $180 if API fails
  } catch {
    console.warn('Failed to get SOL price, using fallback');
    return 180;
  }
}

/**
 * Get treasury wallet keypair
 */
function getTreasuryKeypair(): Keypair {
  const privateKey = process.env.TREASURY_PRIVATE_KEY_SOLANA;
  if (!privateKey) {
    throw new Error('Treasury wallet private key not configured');
  }

  try {
    // Try base58 decode first
    const secretKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    // Try JSON array format
    try {
      const secretKey = new Uint8Array(JSON.parse(privateKey));
      return Keypair.fromSecretKey(secretKey);
    } catch {
      throw new Error('Invalid treasury private key format');
    }
  }
}

/**
 * Send SOL with memo
 */
async function sendSolWithMemo(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string,
  amountSol: number,
  memo: string
): Promise<string> {
  const toPublicKey = new PublicKey(toAddress);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction();

  // Add transfer instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: toPublicKey,
      lamports,
    })
  );

  // Add memo instruction if provided
  if (memo) {
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    transaction.add({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, 'utf-8'),
    });
  }

  // Send and confirm
  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair], {
    commitment: 'confirmed',
  });

  return signature;
}

/**
 * Main function: Auto-deposit to Kripicard
 * 1. Get current SOL price
 * 2. Login to Kripicard and initiate deposit
 * 3. Send SOL from treasury to Kripicard deposit address
 * 4. Return result (polling for credit happens separately)
 */
export async function autoDepositToKripicard(amountUsd: number): Promise<DepositResult> {
  console.log('=== AUTO-DEPOSIT TO KRIPICARD ===');
  console.log('Amount USD:', amountUsd);

  try {
    // Step 1: Get SOL price and calculate amount
    const solPrice = await getSolPrice();
    const amountSol = (amountUsd / solPrice) * 1.02; // Add 2% buffer for price fluctuation
    console.log('SOL Price:', solPrice, 'Amount SOL:', amountSol);

    // Step 2: Get treasury wallet
    const treasuryKeypair = getTreasuryKeypair();
    console.log('Treasury wallet:', treasuryKeypair.publicKey.toString());

    // Step 3: Check treasury balance
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / LAMPORTS_PER_SOL;
    console.log('Treasury balance:', treasuryBalanceSol, 'SOL');

    if (treasuryBalanceSol < amountSol + 0.01) { // Need extra for tx fee
      return {
        success: false,
        message: `Insufficient treasury balance. Have ${treasuryBalanceSol.toFixed(4)} SOL, need ${(amountSol + 0.01).toFixed(4)} SOL`,
      };
    }

    // Step 4: Initiate Kripicard deposit to get address and reference
    console.log('Initiating Kripicard deposit...');
    const depositInfo = await initiateDeposit(amountUsd, 'solana');
    console.log('Deposit info:', depositInfo);

    // Step 5: Send SOL to Kripicard deposit address with memo
    console.log('Sending SOL to Kripicard...');
    const txSignature = await sendSolWithMemo(
      connection,
      treasuryKeypair,
      depositInfo.address,
      amountSol,
      depositInfo.reference
    );
    console.log('Transaction signature:', txSignature);

    return {
      success: true,
      message: 'SOL sent to Kripicard. Waiting for credit.',
      txSignature,
      depositAddress: depositInfo.address,
      reference: depositInfo.reference,
      amountSol,
      amountUsd,
    };
  } catch (error) {
    console.error('Auto-deposit error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Auto-deposit failed',
    };
  }
}

/**
 * Poll until Kripicard credits the deposit
 */
export async function waitForKripicardCredit(
  reference: string,
  maxWaitMs: number = 5 * 60 * 1000, // 5 minutes default
  pollIntervalMs: number = 15 * 1000 // 15 seconds
): Promise<boolean> {
  console.log('Waiting for Kripicard to credit deposit:', reference);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const status = await checkDepositStatus(reference);
      if (status.credited) {
        console.log('Deposit credited!');
        return true;
      }
      console.log('Deposit not yet credited, waiting...');
    } catch (error) {
      console.warn('Error checking deposit status:', error);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.warn('Timeout waiting for deposit credit');
  return false;
}

/**
 * Full flow: Deposit to Kripicard and create card
 */
export async function depositAndCreateCard(
  amountUsd: number,
  cardAmount: number,
  bankBin?: number
): Promise<{
  success: boolean;
  message: string;
  cardId?: string;
  txSignature?: string;
}> {
  // Step 1: Auto-deposit to Kripicard
  const depositResult = await autoDepositToKripicard(amountUsd);
  if (!depositResult.success) {
    return {
      success: false,
      message: depositResult.message,
    };
  }

  // Step 2: Wait for credit (with shorter timeout for testing)
  const credited = await waitForKripicardCredit(
    depositResult.reference || '',
    3 * 60 * 1000, // 3 minutes
    10 * 1000 // 10 seconds
  );

  if (!credited) {
    return {
      success: false,
      message: 'Deposit sent but not yet credited. Card creation pending.',
      txSignature: depositResult.txSignature,
    };
  }

  // Step 3: Create card via API
  const apiKey = process.env.KRIPICARD_API_KEY;
  const bin = bankBin || Number(process.env.KRIPICARD_BANK_BIN);

  const createCardResponse = await fetch('https://kripicard.com/api/premium/Create_card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      amount: cardAmount,
      bankBin: bin,
    }),
  });

  const cardData = await createCardResponse.json();

  if (!cardData.success) {
    return {
      success: false,
      message: cardData.message || 'Failed to create card after deposit',
      txSignature: depositResult.txSignature,
    };
  }

  return {
    success: true,
    message: 'Card created successfully!',
    cardId: cardData.card_id,
    txSignature: depositResult.txSignature,
  };
}

/**
 * Get current Kripicard API balance
 */
export async function getApiBalance(): Promise<number> {
  try {
    const balance = await getKripicardBalance();
    return balance.available;
  } catch (error) {
    console.error('Failed to get Kripicard balance:', error);
    return 0;
  }
}

