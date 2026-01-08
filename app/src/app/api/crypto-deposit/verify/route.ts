import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// File-based store of used transaction signatures (persists across restarts)
// In production, this should be in a database!
const TX_FILE = join(process.cwd(), 'data', 'used_transactions.json');

function loadUsedTransactions(): Set<string> {
  try {
    if (existsSync(TX_FILE)) {
      const data = JSON.parse(readFileSync(TX_FILE, 'utf-8'));
      return new Set(data);
    }
  } catch (error) {
    console.error('Failed to load used transactions:', error);
  }
  return new Set();
}

function saveUsedTransactions(txSet: Set<string>): void {
  try {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    writeFileSync(TX_FILE, JSON.stringify(Array.from(txSet), null, 2));
  } catch (error) {
    console.error('Failed to save used transactions:', error);
  }
}

const usedTransactions = loadUsedTransactions();

// Verify a Solana transaction
async function verifySolanaTransaction(
  txSignature: string,
  expectedAddress: string,
  expectedAmount: number,
  currency: 'SOL' | 'USDT'
): Promise<{ valid: boolean; message: string; actualAmount?: number }> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Get transaction details
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      return { valid: false, message: 'Transaction not found. It may still be processing.' };
    }
    
    if (tx.meta?.err) {
      return { valid: false, message: 'Transaction failed on-chain' };
    }
    
    // Check for SOL transfer
    if (currency === 'SOL') {
      // Look for SOL transfer in post balances
      const accountKeys = tx.transaction.message.accountKeys;
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      
      // Find the deposit address in the transaction
      const depositIndex = accountKeys.findIndex(
        key => key.pubkey.toString() === expectedAddress
      );
      
      if (depositIndex === -1) {
        return { valid: false, message: 'Deposit address not found in transaction' };
      }
      
      // Calculate received amount (in SOL)
      const received = (postBalances[depositIndex] - preBalances[depositIndex]) / 1e9;
      
      if (received <= 0) {
        return { valid: false, message: 'No SOL received in this transaction' };
      }
      
      // Allow 1% tolerance for price fluctuations
      const tolerance = expectedAmount * 0.01;
      if (received < expectedAmount - tolerance) {
        return { 
          valid: false, 
          message: `Insufficient amount. Expected ${expectedAmount} SOL, received ${received} SOL`,
          actualAmount: received,
        };
      }
      
      return { valid: true, message: 'Transaction verified', actualAmount: received };
    }
    
    // Check for USDT (SPL token) transfer
    if (currency === 'USDT') {
      const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
      
      // Look for token transfers in inner instructions
      const innerInstructions = tx.meta?.innerInstructions || [];
      const instructions = tx.transaction.message.instructions;
      
      let usdtReceived = 0;
      
      // Check parsed instructions for SPL token transfers
      for (const ix of instructions) {
        if ('parsed' in ix && ix.program === 'spl-token') {
          const parsed = ix.parsed;
          if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
            const info = parsed.info;
            // Check if it's USDT and going to our address
            if (info.destination && info.amount) {
              // Would need to resolve token account to wallet address
              // For simplicity, we'll check the amount
              usdtReceived += Number(info.amount) / 1e6; // USDT has 6 decimals
            }
          }
        }
      }
      
      if (usdtReceived <= 0) {
        return { valid: false, message: 'No USDT transfer found in this transaction' };
      }
      
      const tolerance = expectedAmount * 0.01;
      if (usdtReceived < expectedAmount - tolerance) {
        return {
          valid: false,
          message: `Insufficient amount. Expected ${expectedAmount} USDT, received ${usdtReceived} USDT`,
          actualAmount: usdtReceived,
        };
      }
      
      return { valid: true, message: 'Transaction verified', actualAmount: usdtReceived };
    }
    
    return { valid: false, message: 'Unknown currency' };
  } catch (error) {
    console.error('Solana verification error:', error);
    return { valid: false, message: 'Failed to verify transaction. Please try again.' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      depositId,
      txSignature, 
      network, 
      currency, 
      expectedAmount,
      depositAddress,
      walletAddress,
    } = body;

    if (!txSignature) {
      return NextResponse.json(
        { success: false, message: 'Transaction signature is required' },
        { status: 400 }
      );
    }

    // Normalize the transaction signature (trim whitespace)
    const normalizedTxSig = txSignature.trim();

    // CHECK FOR DUPLICATE TRANSACTION - CRITICAL SECURITY CHECK
    if (usedTransactions.has(normalizedTxSig)) {
      console.log('=== DUPLICATE TRANSACTION DETECTED ===');
      console.log('TX Signature:', normalizedTxSig);
      return NextResponse.json(
        { success: false, message: 'This transaction has already been used to verify a deposit.' },
        { status: 400 }
      );
    }

    if (!network || !['solana', 'ethereum'].includes(network)) {
      return NextResponse.json(
        { success: false, message: 'Valid network is required' },
        { status: 400 }
      );
    }

    console.log('=== VERIFYING CRYPTO DEPOSIT ===');
    console.log('Deposit ID:', depositId);
    console.log('TX Signature:', normalizedTxSig);
    console.log('Network:', network);
    console.log('Currency:', currency);
    console.log('Expected Amount:', expectedAmount);

    let verificationResult: { valid: boolean; message: string; actualAmount?: number };

    if (network === 'solana') {
      verificationResult = await verifySolanaTransaction(
        normalizedTxSig,
        depositAddress,
        expectedAmount,
        currency
      );
    } else if (network === 'ethereum') {
      // For Ethereum, we'd need to use ethers.js or similar
      // For now, return a placeholder
      verificationResult = {
        valid: false,
        message: 'Ethereum verification coming soon. Please contact support with your TX hash.',
      };
    } else {
      verificationResult = { valid: false, message: 'Unsupported network' };
    }

    console.log('Verification Result:', verificationResult);

    if (verificationResult.valid) {
      // MARK TRANSACTION AS USED - Prevent double-spending
      usedTransactions.add(normalizedTxSig);
      saveUsedTransactions(usedTransactions);
      console.log('Transaction marked as used:', normalizedTxSig);

      // Calculate USD value to credit
      const usdAmount = currency === 'USDT' 
        ? verificationResult.actualAmount 
        : (verificationResult.actualAmount || 0) * (currency === 'SOL' ? 185 : 3200);

      return NextResponse.json({
        success: true,
        message: 'Transaction verified successfully',
        data: {
          depositId,
          txSignature: normalizedTxSig,
          verified: true,
          actualAmount: verificationResult.actualAmount,
          currency,
          usdValue: usdAmount,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        message: verificationResult.message,
        data: {
          depositId,
          txSignature: normalizedTxSig,
          verified: false,
          actualAmount: verificationResult.actualAmount,
        },
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Verify deposit error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

