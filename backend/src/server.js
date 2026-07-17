import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getRepoInfo } from './github.js';
import { streamReadme } from './claude.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '150kb' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    if (!origins.includes(origin)) return res.status(403).json({ error: 'Origin is not allowed.' });
    res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const apiLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please try again later.' } });
app.get('/repo-info', apiLimit, async (req, res, next) => {
  try {
    const info = await getRepoInfo(req.query.url);
    res.json(info);
  } catch (error) { next(error); }
});

app.post('/generate', apiLimit, async (req, res, next) => {
  const context = req.body?.context;
  if (!context?.repository || !Array.isArray(context.tree) || !Array.isArray(context.keyFiles)) {
    return res.status(400).json({ error: 'A valid repository context is required. Fetch repository info first.' });
  }
  if (JSON.stringify(context).length > 145_000) return res.status(413).json({ error: 'Repository context is too large for this demo.' });

  res.status(200).set({ 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.flushHeaders();
  try {
    await streamReadme(context, (text) => res.write(text));
    res.end();
  } catch (error) {
    console.error(JSON.stringify({ event: 'generate_failed', message: error.message, detail: error.detail }));
    // Headers are already sent to preserve streaming. Write a Markdown-safe error message.
    res.write(`\n\n> Generation failed: ${error.message}\n`);
    res.end();
  }
});

app.use((error, _req, res, _next) => {
  console.error(JSON.stringify({ event: 'request_failed', message: error.message, status: error.status }));
  res.status(error.status === 404 ? 404 : 400).json({ error: error.message || 'Request failed.' });
});
app.listen(port, () => console.log(`README Forge API listening on ${port}`));
