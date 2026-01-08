import { NextRequest, NextResponse } from 'next/server';
import {
  loadPendingDeposits,
  getDepositByPaymentId,
  markDepositAsConfirmed,
  markDepositAsCredited,
  markDepositAsFailed,
  getDepositSummary,
  addPendingDeposit,
} from '@/lib/pending-deposits';

// Cryptomus webhook payload type
interface CryptomusWebhook {
  type: string;
  uuid: string;
  order_id: string;
  amount: string;
  payment_amount: string;
  payment_amount_usd: string;
  merchant_amount: string;
  commission: string;
  is_final: boolean;
  status: string;
  from: string;
  wallet_address_uuid: string;
  network: string;
  currency: string;
  payer_currency: string;
  additional_data: string;
  txid: string;
  sign: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const webhookData: CryptomusWebhook = JSON.parse(body);
    
    console.log('=== CRYPTOMUS WEBHOOK RECEIVED ===');
    console.log('Payment ID:', webhookData.uuid);
    console.log('Status:', webhookData.status);
    console.log('Amount USD:', webhookData.payment_amount_usd);
    console.log('Currency:', webhookData.currency);
    console.log('Network:', webhookData.network);
    console.log('Is Final:', webhookData.is_final);
    console.log('TXID:', webhookData.txid);

    const paymentId = webhookData.uuid;
    const status = webhookData.status;
    
    // Check if we're tracking this deposit
    let deposit = await getDepositByPaymentId(paymentId);
    
    if (!deposit) {
      // New deposit we didn't track - add it
      console.log(`New deposit from webhook: ${paymentId}`);
      deposit = await addPendingDeposit({
        paymentId,
        amountUsd: parseFloat(webhookData.payment_amount_usd) || 0,
        amountCrypto: `${webhookData.payment_amount} ${webhookData.currency}`,
        currency: webhookData.currency,
      });
    }

    // Update deposit status based on Cryptomus status
    if (status === 'paid' || status === 'paid_over' || status === 'confirm_check') {
      await markDepositAsConfirmed(paymentId);
      console.log(`✅ Deposit ${paymentId} confirmed!`);
      
      // Automatically try to create a card
      if (!deposit.cardCreated) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const cardResponse = await fetch(`${appUrl}/api/kripicard/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10 }), // Minimum card amount
          });
          
          const cardResult = await cardResponse.json();
          if (cardResult.success) {
            await markDepositAsCredited(paymentId, true, cardResult.cardId);
            console.log('🎉 Card created automatically!', cardResult);
          } else {
            await markDepositAsCredited(paymentId, false);
            console.log('Card creation failed:', cardResult.message);
          }
        } catch (cardError) {
          console.error('Error creating card:', cardError);
          await markDepositAsCredited(paymentId, false);
        }
      }
    } else if (status === 'cancel' || status === 'fail' || status === 'wrong_amount') {
      await markDepositAsFailed(paymentId, `Payment ${status}`);
      console.log(`❌ Deposit ${paymentId} failed: ${status}`);
    }

    // Respond to Cryptomus
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed',
      paymentId,
      status,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check pending deposits status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get('paymentId');
  
  if (paymentId) {
    const deposit = await getDepositByPaymentId(paymentId);
    if (deposit) {
      return NextResponse.json({ success: true, deposit });
    }
    return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 });
  }
  
  // Return all deposits and summary
  const deposits = await loadPendingDeposits();
  const summary = await getDepositSummary();
  
  return NextResponse.json({
    success: true,
    deposits,
    summary,
  });
}
