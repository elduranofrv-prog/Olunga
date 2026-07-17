/** Convert Kenyan local, 254, and +254 numbers to Daraja's 2547XXXXXXXX format. */
export function normalizeKenyanPhone(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim().replace(/[\s()-]/g, '');
  let national;
  if (/^\+254[17]\d{8}$/.test(input)) national = input.slice(1);
  else if (/^254[17]\d{8}$/.test(input)) national = input;
  else if (/^0[17]\d{8}$/.test(input)) national = `254${input.slice(1)}`;
  else return null;
  return national;
}

export function parseAmount(value) {
  // Daraja's STK Amount field is intentionally restricted to whole KES.
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 150000) return null;
  return amount;
}

export function validatePayment(body) {
  const phoneNumber = normalizeKenyanPhone(body?.phoneNumber);
  const amount = parseAmount(body?.amount);
  const errors = {};
  if (!phoneNumber) errors.phoneNumber = 'Use a valid Kenyan mobile number, e.g. 0712345678.';
  if (!amount) errors.amount = 'Amount must be a whole number from 1 to 150000 KES.';
  return { valid: Object.keys(errors).length === 0, errors, phoneNumber, amount };
}
