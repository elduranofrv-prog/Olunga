import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { loadConfig } from './config.js';
import { DarajaClient } from './daraja.js';
import { validatePayment } from './validation.js';

const config = loadConfig();
const daraja = new DarajaClient(config);
const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.disable('x-powered-by');
app.set('trust proxy', 1); // Required behind Railway's reverse proxy for secure cookies/IP rate limiting.
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"] } } }));
app.use(express.json({ limit: '20kb', type: ['application/json', 'application/*+json'] }));

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const origin = req.get('origin');
  const ownOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin && origin !== ownOrigin && !config.allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed.', requestId });
  }
  if (origin && origin !== ownOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/pay', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many payment requests. Please try again later.' } }));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.post('/pay', async (req, res, next) => {
  const payment = validatePayment(req.body);
  if (!payment.valid) return res.status(400).json({ error: 'Invalid payment details.', fields: payment.errors });

  try {
    const result = await daraja.stkPush(payment);
    // An accepted STK request is not a completed payment. Completion arrives at /callback.
    return res.status(202).json({
      message: 'STK Push sent. Complete the prompt on the phone.',
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      customerMessage: result.CustomerMessage
    });
  } catch (error) {
    const upstreamStatus = error.status;
    console.error(JSON.stringify({ event: 'stk_push_failed', requestId: req.requestId, upstreamStatus, daraja: error.data, message: error.message }));
    return res.status(upstreamStatus && upstreamStatus < 500 ? 502 : 503).json({
      error: 'Unable to initiate the payment right now. Please try again.',
      requestId: req.requestId
    });
  }
});

app.post('/callback', (req, res) => {
  // Daraja callbacks are asynchronous. Persist this payload to a database and reconcile it
  // with CheckoutRequestID before marking an order paid in a multi-instance production app.
  console.info(JSON.stringify({ event: 'daraja_stk_callback', receivedAt: new Date().toISOString(), payload: req.body }));
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.use(express.static(path.join(root, 'public'), { extensions: ['html'], maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));

app.use((req, res) => res.status(404).json({ error: 'Not found.', requestId: req.requestId }));
app.use((error, req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.', requestId: req.requestId });
  }
  console.error(JSON.stringify({ event: 'unhandled_error', requestId: req.requestId, message: error.message }));
  res.status(500).json({ error: 'Internal server error.', requestId: req.requestId });
});

app.listen(config.port, () => console.info(`Olunga Daraja server listening on port ${config.port} (${config.nodeEnv})`));
