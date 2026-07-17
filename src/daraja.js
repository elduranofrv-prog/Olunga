let tokenCache = null;

function timestampNow() {
  // Daraja timestamps are conventionally supplied in Kenya/East Africa time.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

async function requestJson(url, options, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const error = new Error(`Daraja request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export class DarajaClient {
  constructor(config) { this.config = config; }

  async getAccessToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
    const credentials = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
    const data = await requestJson(this.config.oauthUrl, {
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' }
    });
    if (!data.access_token) throw new Error('Daraja OAuth response did not include an access token.');
    // Refresh one minute early. Daraja commonly returns expires_in as seconds.
    tokenCache = { value: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3599) - 60) * 1000 };
    return tokenCache.value;
  }

  async stkPush({ phoneNumber, amount }) {
    const timestamp = timestampNow();
    const password = Buffer.from(`${this.config.businessShortCode}${this.config.passkey}${timestamp}`).toString('base64');
    const token = await this.getAccessToken();
    return requestJson(this.config.stkPushUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: this.config.businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: this.config.callbackUrl,
        AccountReference: this.config.accountReference,
        TransactionDesc: this.config.transactionDesc
      })
    });
  }
}
