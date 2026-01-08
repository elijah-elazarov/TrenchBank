// Cryptomus Payment Gateway Integration
// Documentation: https://doc.cryptomus.com/

import crypto from 'crypto';

const CRYPTOMUS_API_URL = 'https://api.cryptomus.com/v1';

interface CryptomusConfig {
  merchantId: string;
  paymentKey: string;
}

function getConfig(): CryptomusConfig {
  const merchantId = process.env.CRYPTOMUS_MERCHANT_ID;
  const paymentKey = process.env.CRYPTOMUS_PAYMENT_KEY;
  
  if (!merchantId || !paymentKey) {
    throw new Error('Cryptomus credentials not configured. Set CRYPTOMUS_MERCHANT_ID and CRYPTOMUS_PAYMENT_KEY');
  }
  
  return { merchantId, paymentKey };
}

// Generate signature for Cryptomus API requests
function generateSignature(data: Record<string, unknown>, apiKey: string): string {
  const jsonString = JSON.stringify(data);
  const base64 = Buffer.from(jsonString).toString('base64');
  return crypto.createHash('md5').update(base64 + apiKey).digest('hex');
}

// Verify webhook signature from Cryptomus
export function verifyWebhookSignature(body: Record<string, unknown>, signature: string): boolean {
  const { paymentKey } = getConfig();
  const expectedSignature = generateSignature(body, paymentKey);
  return signature === expectedSignature;
}

export interface CreatePaymentParams {
  amount: number; // Amount in USD
  orderId: string; // Unique order ID (our deposit ID)
  walletAddress: string; // User's wallet address for reference
  currency?: string; // Payment currency (USDT, BTC, etc.) - if not set, user chooses
  urlCallback?: string; // Webhook URL
  urlReturn?: string; // URL to redirect after payment
  urlSuccess?: string; // URL on successful payment
}

export interface CryptomusPaymentResponse {
  success: boolean;
  state?: number;
  result?: {
    uuid: string;
    order_id: string;
    amount: string;
    payment_amount: string | null;
    payment_amount_usd: string | null;
    payer_amount: string | null;
    payer_amount_exchange_rate: string | null;
    discount_percent: number | null;
    discount: string;
    payer_currency: string | null;
    currency: string;
    comments: string | null;
    merchant_amount: string | null;
    network: string | null;
    address: string | null;
    from: string | null;
    txid: string | null;
    payment_status: string;
    url: string;
    expired_at: number;
    status: string;
    is_final: boolean;
    additional_data: string | null;
    created_at: string;
    updated_at: string;
  };
  message?: string;
}

export interface CryptomusWebhookPayload {
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
  wallet_address_uuid: string | null;
  network: string;
  currency: string;
  payer_currency: string;
  additional_data: string | null;
  txid: string;
  sign: string;
}

// Create a new payment invoice
export async function createPayment(params: CreatePaymentParams): Promise<CryptomusPaymentResponse> {
  const { merchantId, paymentKey } = getConfig();
  
  const data: Record<string, unknown> = {
    amount: params.amount.toString(),
    currency: 'USD', // We request in USD, user pays in crypto
    order_id: params.orderId,
    additional_data: JSON.stringify({ wallet: params.walletAddress }),
  };
  
  // Optional: specify which crypto to accept
  if (params.currency) {
    data.to_currency = params.currency;
  }
  
  // Webhook URL for payment notifications
  if (params.urlCallback) {
    data.url_callback = params.urlCallback;
  }
  
  // Return URLs
  if (params.urlReturn) {
    data.url_return = params.urlReturn;
  }
  if (params.urlSuccess) {
    data.url_success = params.urlSuccess;
  }
  
  // Set lifetime (1 hour)
  data.lifetime = 3600;
  
  const signature = generateSignature(data, paymentKey);
  
  const response = await fetch(`${CRYPTOMUS_API_URL}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'merchant': merchantId,
      'sign': signature,
    },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('Cryptomus API error:', result);
    return {
      success: false,
      message: result.message || 'Failed to create payment',
    };
  }
  
  return {
    success: true,
    ...result,
  };
}

// Get payment info by UUID
export async function getPaymentInfo(uuid: string): Promise<CryptomusPaymentResponse> {
  const { merchantId, paymentKey } = getConfig();
  
  const data = { uuid };
  const signature = generateSignature(data, paymentKey);
  
  const response = await fetch(`${CRYPTOMUS_API_URL}/payment/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'merchant': merchantId,
      'sign': signature,
    },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    return {
      success: false,
      message: result.message || 'Failed to get payment info',
    };
  }
  
  return {
    success: true,
    ...result,
  };
}

// Payment status mappings
export const PAYMENT_STATUSES = {
  process: 'Processing payment',
  check: 'Checking payment',
  paid: 'Payment received',
  paid_over: 'Overpaid',
  fail: 'Payment failed',
  wrong_amount: 'Wrong amount sent',
  cancel: 'Cancelled',
  system_fail: 'System error',
  refund_process: 'Refund processing',
  refund_fail: 'Refund failed',
  refund_paid: 'Refunded',
} as const;

// Check if payment status is successful
export function isPaymentSuccessful(status: string): boolean {
  return status === 'paid' || status === 'paid_over';
}

// Check if payment is final (no more changes expected)
export function isPaymentFinal(status: string): boolean {
  const finalStatuses = ['paid', 'paid_over', 'fail', 'wrong_amount', 'cancel', 'system_fail', 'refund_paid'];
  return finalStatuses.includes(status);
}

