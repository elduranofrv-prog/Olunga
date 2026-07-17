# Olunga M-Pesa STK Push (Daraja Sandbox)

A Node.js/Express implementation of Safaricom Daraja **Sandbox** Lipa na M-Pesa Online (STK Push). It accepts a Kenyan phone number and a whole-KES amount, requests a cached OAuth token, sends the STK prompt, and receives the asynchronous confirmation callback.

> **Sandbox only:** this project deliberately uses Safaricom's sandbox API URLs. It is not configured for real-money production processing.

## Features

- Cached Daraja OAuth access token with early refresh
- `POST /pay` with strict Kenyan-number and KES amount validation
- Correct Daraja STK password/timestamp construction
- Timeout-bound upstream requests, safe client errors, request IDs, Helmet, JSON size limits, and payment rate limiting
- `POST /callback` that logs the unmodified Daraja callback payload and acknowledges it
- Responsive zero-dependency frontend
- Railway deployment configuration and health check

## Project tree

```text
.
├── .env.example                 # required runtime variable names (safe to commit)
├── .gitignore
├── package.json
├── railway.json                 # Railway/Nixpacks deployment settings
├── README.md
├── docs/
│   └── screenshots/
│       └── .gitkeep             # add screenshots here
├── public/
│   ├── app.js                   # form submission/status behavior
│   ├── index.html               # payment form
│   └── styles.css
├── src/
│   ├── config.js                # environment validation
│   ├── daraja.js                # OAuth + STK Push client
│   ├── server.js                # Express routes/middleware
│   └── validation.js            # reusable input validation
└── test/
    └── validation.test.js
```

## Prerequisites

- Node.js 20+
- A free Safaricom Daraja developer account and Sandbox application: <https://developer.safaricom.co.ke/>
- A public **HTTPS** URL for callbacks. Railway supplies one after deployment.

## Local setup

1. Install packages:

   ```bash
   npm install
   ```

2. Create your private environment file and fill it in:

   ```bash
   cp .env.example .env
   ```

3. In the Daraja portal's Sandbox app, copy the **Consumer Key**, **Consumer Secret**, sandbox Business Short Code, and **Lipa Na M-Pesa Online Passkey** into `.env`. Set `DARAJA_CALLBACK_URL` to your deployed public endpoint, for example:

   ```env
   DARAJA_CALLBACK_URL=https://your-service.up.railway.app/callback
   ```

   `localhost` cannot receive a callback from Daraja. During local development deploy first, or use a secure public tunnel whose URL is set in `.env`.

4. Start the server:

   ```bash
   npm run dev
   ```

5. Visit <http://localhost:3000>, submit a Sandbox test phone number and a whole-KES amount, then complete the simulated STK prompt using the test details Daraja documents for your app.

6. Run tests:

   ```bash
   npm test
   ```

## Environment variables

All required names and safe example values are in [`.env.example`](.env.example). Never commit `.env` or expose its consumer secret/passkey in browser code.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | no | `development` or `production` |
| `PORT` | no | HTTP port; Railway injects this automatically |
| `ALLOWED_ORIGINS` | no | Comma-separated allowed cross-origin frontend URLs; same-origin needs none |
| `DARAJA_CONSUMER_KEY` | yes | Daraja Sandbox app consumer key |
| `DARAJA_CONSUMER_SECRET` | yes | Daraja Sandbox app consumer secret |
| `DARAJA_BUSINESS_SHORT_CODE` | yes | Sandbox paybill/shortcode |
| `DARAJA_PASSKEY` | yes | Lipa Na M-Pesa Online passkey |
| `DARAJA_CALLBACK_URL` | yes | Public HTTPS callback URL ending in `/callback` |
| `DARAJA_ACCOUNT_REFERENCE` | no | Short transaction reference, defaults to `OLUNGA` |
| `DARAJA_TRANSACTION_DESC` | no | Short transaction description, defaults to `Payment` |
| `DARAJA_OAUTH_URL` | no | Sandbox OAuth URL override |
| `DARAJA_STK_PUSH_URL` | no | Sandbox STK endpoint override |

## API

### `POST /pay`

Request:

```json
{ "phoneNumber": "0712345678", "amount": 100 }
```

Phone input may be `07…`, `01…`, `254…`, or `+254…`; it is normalized to Daraja's `2547XXXXXXXX`/`2541XXXXXXXX` format. Amount is limited to an integer from 1 to 150,000 KES. An accepted response (`202`) means Daraja accepted the prompt request—not that funds were paid.

### `POST /callback`

Daraja posts the final STK result here. The service logs the received JSON payload with the `daraja_stk_callback` event and returns HTTP 200. Watch Railway deployment logs to inspect it.

**Important:** callbacks are asynchronous, can be retried, and should not be treated as trusted payment completion solely because they arrive. Before a real production rollout, persist an order and `CheckoutRequestID`, make callback processing idempotent, reconcile the callback with that order (and ideally Daraja's query/reconciliation process), and use a durable database/queue. This sandbox starter intentionally has no paid database dependency.

### `GET /health`

Returns `{"status":"ok"}` and is used by Railway health checks.

## Deploying on Railway (free-tier-only setup)

1. Push this repository to GitHub and create a Railway project from it.
2. Railway detects `package.json` and uses `npm start`; `railway.json` configures `/health`.
3. Add every required `DARAJA_*` variable from `.env.example` in Railway's **Variables** panel. Do not upload `.env`.
4. Generate a Railway public domain and set `DARAJA_CALLBACK_URL` exactly to `https://<your-domain>/callback`.
5. Redeploy after changing the callback variable. Open the generated domain and test with Daraja Sandbox values.

Railway plans, trial allowances, and domain availability can change. Select only a currently available free/trial offering, monitor usage, and do not add paid add-ons. Safaricom Daraja Sandbox is used here; no paid API is required.

## Screenshot placeholders

Add captured screenshots after running the app:

- `docs/screenshots/payment-form.png` — empty payment form
- `docs/screenshots/stk-prompt-sent.png` — successful prompt submission message
- `docs/screenshots/railway-callback-log.png` — redacted callback log

```md
![Payment form](docs/screenshots/payment-form.png)
![STK Push sent](docs/screenshots/stk-prompt-sent.png)
![Callback log](docs/screenshots/railway-callback-log.png)
```

Do not include phone numbers, access tokens, passkeys, or full personally identifiable callback payloads in screenshots.

## Ownership

All rights onwards are given to **Olungas Lunga Consty, the Shadow Developer**.
