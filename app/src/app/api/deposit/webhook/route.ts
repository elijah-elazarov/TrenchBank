import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, isPaymentSuccessful, CryptomusWebhookPayload } from '@/lib/cryptomus';

// In-memory store for demo (in production, use a database)
// We'll store deposits server-side and sync with client
const serverDeposits: Map<string, {
  orderId: string;
  walletAddress: string;
  amount: number;
  status: string;
  paymentId: string;
  paidAt?: string;
}> = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CryptomusWebhookPayload;
    
    console.log('=== CRYPTOMUS WEBHOOK RECEIVED ===');
    console.log('Order ID:', body.order_id);
    console.log('Status:', body.status);
    console.log('Amount:', body.payment_amount_usd, 'USD');
    console.log('Is Final:', body.is_final);

    // Verify webhook signature
    const signature = body.sign;
    // Remove sign from body for verification
    const { sign: _, ...bodyWithoutSign } = body;
    
    if (!verifyWebhookSignature(bodyWithoutSign as Record<string, unknown>, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Extract wallet address from additional_data
    let walletAddress = '';
    if (body.additional_data) {
      try {
        const additionalData = JSON.parse(body.additional_data);
        walletAddress = additionalData.wallet || '';
      } catch {
        console.warn('Could not parse additional_data');
      }
    }

    // Process payment status
    if (isPaymentSuccessful(body.status)) {
      console.log('=== PAYMENT SUCCESSFUL ===');
      
      // Calculate the credited amount (subtract our fee)
      // Fee: 2% + $5
      const totalPaid = parseFloat(body.payment_amount_usd);
      const fee = (totalPaid * 0.02) + 5;
      const creditAmount = totalPaid - fee;
      
      console.log('Total Paid:', totalPaid);
      console.log('Fee:', fee);
      console.log('Credit Amount:', creditAmount);
      
      // Store the successful deposit
      serverDeposits.set(body.order_id, {
        orderId: body.order_id,
        walletAddress,
        amount: creditAmount,
        status: 'paid',
        paymentId: body.uuid,
        paidAt: new Date().toISOString(),
      });
      
      // In a real app, you would:
      // 1. Update database with payment status
      // 2. Credit user's balance in database
      // 3. Optionally trigger notifications
      
      console.log('Deposit completed for wallet:', walletAddress, 'Amount:', creditAmount);
    } else if (body.is_final) {
      // Payment failed or cancelled
      console.log('=== PAYMENT FAILED/CANCELLED ===');
      console.log('Final Status:', body.status);
      
      serverDeposits.set(body.order_id, {
        orderId: body.order_id,
        walletAddress,
        amount: 0,
        status: body.status,
        paymentId: body.uuid,
      });
    } else {
      // Payment still processing
      console.log('=== PAYMENT PROCESSING ===');
    }

    // Cryptomus expects a success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Export deposits for status checks
export { serverDeposits };

