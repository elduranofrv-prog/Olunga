import 'dotenv/config';

const required = [
  'DARAJA_CONSUMER_KEY',
  'DARAJA_CONSUMER_SECRET',
  'DARAJA_BUSINESS_SHORT_CODE',
  'DARAJA_PASSKEY',
  'DARAJA_CALLBACK_URL'
];

function requiredValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig() {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Configuration incomplete. Missing: ${missing.join(', ')}`);
  }

  const callbackUrl = new URL(requiredValue('DARAJA_CALLBACK_URL'));
  if (callbackUrl.protocol !== 'https:') {
    throw new Error('DARAJA_CALLBACK_URL must use public HTTPS; Daraja cannot call localhost.');
  }

  const shortCode = requiredValue('DARAJA_BUSINESS_SHORT_CODE');
  if (!/^\d{5,8}$/.test(shortCode)) {
    throw new Error('DARAJA_BUSINESS_SHORT_CODE must contain 5 to 8 digits.');
  }

  return Object.freeze({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number.parseInt(process.env.PORT || '3000', 10),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean),
    consumerKey: requiredValue('DARAJA_CONSUMER_KEY'),
    consumerSecret: requiredValue('DARAJA_CONSUMER_SECRET'),
    businessShortCode: shortCode,
    passkey: requiredValue('DARAJA_PASSKEY'),
    callbackUrl: callbackUrl.toString(),
    accountReference: (process.env.DARAJA_ACCOUNT_REFERENCE || 'OLUNGA').trim().slice(0, 12),
    transactionDesc: (process.env.DARAJA_TRANSACTION_DESC || 'Payment').trim().slice(0, 13),
    oauthUrl: process.env.DARAJA_OAUTH_URL || 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPushUrl: process.env.DARAJA_STK_PUSH_URL || 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
  });
}
