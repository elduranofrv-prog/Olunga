import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKenyanPhone, parseAmount, validatePayment } from '../src/validation.js';

test('normalizes accepted Kenyan phone formats', () => {
  assert.equal(normalizeKenyanPhone('0712 345 678'), '254712345678');
  assert.equal(normalizeKenyanPhone('+254712345678'), '254712345678');
  assert.equal(normalizeKenyanPhone('254712345678'), '254712345678');
});

test('rejects invalid numbers and unsafe amounts', () => {
  assert.equal(normalizeKenyanPhone('07001234'), null);
  assert.equal(parseAmount('10.50'), null);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('150001'), null);
  assert.equal(parseAmount('100'), 100);
});

test('reports validation errors without accepting malformed input', () => {
  const result = validatePayment({ phoneNumber: 'not-a-number', amount: '-10' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.phoneNumber);
  assert.ok(result.errors.amount);
});
