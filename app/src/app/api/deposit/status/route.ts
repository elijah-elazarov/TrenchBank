import { NextRequest, NextResponse } from 'next/server';
import { getPaymentInfo, isPaymentSuccessful, isPaymentFinal } from '@/lib/cryptomus';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('paymentId');
    const orderId = searchParams.get('orderId');

    if (!paymentId && !orderId) {
      return NextResponse.json(
        { success: false, message: 'Payment ID or Order ID is required' },
        { status: 400 }
      );
    }

    // Get payment info from Cryptomus
    const paymentInfo = await getPaymentInfo(paymentId || orderId || '');

    if (!paymentInfo.success || !paymentInfo.result) {
      return NextResponse.json(
        { 
          success: false, 
          message: paymentInfo.message || 'Failed to get payment status' 
        },
        { status: 404 }
      );
    }

    const { result } = paymentInfo;
    const isSuccess = isPaymentSuccessful(result.status);
    const isFinal = isPaymentFinal(result.status);

    // Calculate credited amount if payment was successful
    let creditAmount = 0;
    if (isSuccess && result.payment_amount_usd) {
      const totalPaid = parseFloat(result.payment_amount_usd);
      const fee = (totalPaid * 0.02) + 5;
      creditAmount = totalPaid - fee;
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: result.uuid,
        orderId: result.order_id,
        status: result.status,
        isSuccess,
        isFinal,
        amount: result.amount,
        paidAmount: result.payment_amount_usd,
        creditAmount: isSuccess ? creditAmount : 0,
        currency: result.currency,
        payerCurrency: result.payer_currency,
        network: result.network,
        address: result.address,
        txid: result.txid,
        expiresAt: result.expired_at,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    });
  } catch (error) {
    console.error('Get deposit status error:', error);
    
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { success: false, message: 'Payment system not configured' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

