import { NextRequest, NextResponse } from "next/server";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction 
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount
} from "@solana/spl-token";
import bs58 from "bs58";

// Token addresses
const USDT_MINT_SOLANA = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// In-memory withdrawal store (shared with create endpoint - in production use DB)
// For now, we'll refetch the withdrawal from the create endpoint
const processedWithdrawals = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { withdrawalId, walletAddress } = body;

    if (!withdrawalId) {
      return NextResponse.json(
        { success: false, message: "Missing withdrawal ID" },
        { status: 400 }
      );
    }

    // Check if already processed
    if (processedWithdrawals.has(withdrawalId)) {
      return NextResponse.json(
        { success: false, message: "Withdrawal already processed" },
        { status: 400 }
      );
    }

    // Get withdrawal details from the create endpoint
    const withdrawalResponse = await fetch(
      `${req.nextUrl.origin}/api/withdrawal/create?id=${withdrawalId}`
    );
    const withdrawalData = await withdrawalResponse.json();

    if (!withdrawalData.success) {
      return NextResponse.json(
        { success: false, message: "Withdrawal not found" },
        { status: 404 }
      );
    }

    const withdrawal = withdrawalData.data;

    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: `Withdrawal is ${withdrawal.status}` },
        { status: 400 }
      );
    }

    // Mark as processing
    processedWithdrawals.add(withdrawalId);

    let txSignature: string;

    try {
      if (withdrawal.network === 'solana') {
        txSignature = await processSolanaWithdrawal(withdrawal);
      } else if (withdrawal.network === 'ethereum') {
        txSignature = await processEthereumWithdrawal(withdrawal);
      } else {
        throw new Error(`Unsupported network: ${withdrawal.network}`);
      }

      return NextResponse.json({
        success: true,
        data: {
          withdrawalId,
          txSignature,
          status: 'completed',
          network: withdrawal.network,
          explorer: withdrawal.network === 'solana' 
            ? `https://solscan.io/tx/${txSignature}`
            : `https://etherscan.io/tx/${txSignature}`,
        },
      });
    } catch (error: any) {
      // Refund balance on failure
      await fetch(`${req.nextUrl.origin}/api/deposit/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: withdrawal.walletAddress,
          action: 'credit',
          amount: withdrawal.amount,
        }),
      });

      processedWithdrawals.delete(withdrawalId);

      return NextResponse.json({
        success: false,
        message: error.message || "Failed to process withdrawal",
        refunded: true,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Withdrawal process error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process withdrawal" },
      { status: 500 }
    );
  }
}

async function processSolanaWithdrawal(withdrawal: {
  destinationAddress: string;
  cryptoAmount: number;
  currency: string;
}): Promise<string> {
  const privateKey = process.env.TREASURY_PRIVATE_KEY_SOLANA;
  if (!privateKey) {
    throw new Error("Treasury wallet not configured");
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Decode private key (base58 encoded)
  let secretKey: Uint8Array;
  try {
    secretKey = bs58.decode(privateKey);
  } catch {
    // Try as JSON array
    secretKey = new Uint8Array(JSON.parse(privateKey));
  }
  
  const treasuryKeypair = Keypair.fromSecretKey(secretKey);
  const destinationPubkey = new PublicKey(withdrawal.destinationAddress);

  if (withdrawal.currency === 'SOL') {
    // Send native SOL
    const lamports = Math.floor(withdrawal.cryptoAmount * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: destinationPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);
    return signature;

  } else if (withdrawal.currency === 'USDT') {
    // Send USDT SPL token
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT_SOLANA,
      treasuryKeypair.publicKey
    );

    const destinationTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT_SOLANA,
      destinationPubkey
    );

    // USDT has 6 decimals
    const tokenAmount = Math.floor(withdrawal.cryptoAmount * 1_000_000);

    const transaction = new Transaction().add(
      createTransferInstruction(
        treasuryTokenAccount,
        destinationTokenAccount,
        treasuryKeypair.publicKey,
        tokenAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);
    return signature;
  }

  throw new Error(`Unsupported Solana currency: ${withdrawal.currency}`);
}

async function processEthereumWithdrawal(withdrawal: {
  destinationAddress: string;
  cryptoAmount: number;
  currency: string;
}): Promise<string> {
  // For Ethereum, we'll use ethers.js
  // This requires the ethers package to be installed
  
  const privateKey = process.env.TREASURY_PRIVATE_KEY_ETHEREUM;
  if (!privateKey) {
    throw new Error("Ethereum treasury wallet not configured");
  }

  const rpcUrl = process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com";

  // Dynamic import to avoid issues if ethers isn't installed
  const { ethers } = await import("ethers");
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  if (withdrawal.currency === 'ETH') {
    // Send native ETH
    const tx = await wallet.sendTransaction({
      to: withdrawal.destinationAddress,
      value: ethers.parseEther(withdrawal.cryptoAmount.toFixed(18)),
    });

    const receipt = await tx.wait();
    return receipt?.hash || tx.hash;

  } else if (withdrawal.currency === 'USDT') {
    // Send USDT ERC-20
    const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const USDT_ABI = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function decimals() view returns (uint8)",
    ];

    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, wallet);
    
    // USDT has 6 decimals
    const amount = BigInt(Math.floor(withdrawal.cryptoAmount * 1_000_000));
    
    const tx = await usdtContract.transfer(withdrawal.destinationAddress, amount);
    const receipt = await tx.wait();
    return receipt?.hash || tx.hash;
  }

  throw new Error(`Unsupported Ethereum currency: ${withdrawal.currency}`);
}

