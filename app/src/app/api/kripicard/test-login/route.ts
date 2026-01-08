import { NextResponse } from 'next/server';
import { loginToKripicard, getKripicardBalance, initiateDeposit, clearSession } from '@/lib/kripicard-dashboard';

/**
 * GET /api/kripicard/test-login
 * Test the Kripicard dashboard login and get balance
 */
export async function GET() {
  try {
    // Clear any cached session to force fresh login
    clearSession();
    
    console.log('=== TESTING KRIPICARD LOGIN ===');
    
    // Step 1: Try to login
    const session = await loginToKripicard();
    console.log('Login successful, session expires at:', new Date(session.expiresAt));
    
    // Step 2: Get balance
    const balance = await getKripicardBalance();
    console.log('Balance:', balance);
    
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        balance: balance.available,
        currency: balance.currency,
        sessionExpires: new Date(session.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('Login test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Login failed',
        error: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kripicard/test-login
 * Test initiating a deposit
 */
export async function POST() {
  try {
    console.log('=== TESTING KRIPICARD DEPOSIT INITIATION ===');
    
    // Try to initiate a deposit
    const depositInfo = await initiateDeposit(25, 'solana'); // $25 test
    
    return NextResponse.json({
      success: true,
      message: 'Deposit initiated',
      data: depositInfo,
    });
  } catch (error) {
    console.error('Deposit test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Deposit initiation failed',
        error: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

