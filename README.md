# README Forge

README Forge is a stateless AI developer tool that turns a public GitHub repository URL into a professional Markdown README draft. The React/Vite interface fetches repository context through an Express API, then displays Claude's response as it streams in—with source Markdown and a live rendered preview.

## What it does

- Accepts a public `github.com/owner/repository` URL
- Uses the unauthenticated GitHub REST API to retrieve:
  - repository metadata and the recursive file tree
  - root `package.json`, where present
  - up to 12 top-level `.js`, `.jsx`, `.ts`, `.tsx`, or `.py` files
- Sends a bounded, structured context to Anthropic's `claude-sonnet-4-6`
- Streams Markdown response chunks from the backend to the browser
- Provides live Markdown preview, Copy, and Download `README.md` controls
- Uses no database and stores no repository content

## Project structure

```text
.
├── backend/
│   ├── package.json
│   └── src/
│       ├── claude.js       # Anthropic streaming client
│       ├── github.js       # public GitHub REST API client
│       └── server.js       # Express API
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx        # React application
│       └── styles.css
├── .env.example            # backend environment settings
├── package.json            # npm workspaces root
├── railway.json            # Railway service configuration
└── vercel.json             # Vercel static frontend configuration
```

## Requirements

- Node.js 20 or newer
- An Anthropic API key with access to `claude-sonnet-4-6`
- Public GitHub repositories only. The demo intentionally makes unauthenticated GitHub calls, which are limited to 60 requests/hour per IP by GitHub.

## Local development

Install workspace dependencies from the repository root:

```bash
npm install
```

Create backend environment settings:

```bash
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env`. Keep this key server-side; do not put it in the Vite frontend environment.

Create frontend settings:

```bash
cp frontend/.env.example frontend/.env
```

Start the API in one terminal:

```bash
npm run dev:backend
```

Start Vite in a second terminal:

```bash
npm run dev:frontend
```

Open the URL shown by Vite (normally `http://localhost:5173`).

## API

### `GET /repo-info?url=<github-url>`

Fetches a normalized repository context. It only supports public standard GitHub repository URLs. GitHub response timeouts, large trees, and files larger than 45 KB are guarded to keep the demo responsive.

### `POST /generate`

Accepts:

```json
{ "context": { "repository": {}, "tree": [], "keyFiles": [] } }
```

Returns a chunked `text/markdown` response. The endpoint asks Claude to output Markdown only and explicitly instructs it not to invent facts unsupported by the repository context.

### `GET /health`

Returns `{"status":"ok"}` for Railway health checks.

## Deployment

### Backend: Railway

1. Create a Railway project from this GitHub repository.
2. Railway reads `railway.json` and starts the root workspace command (`npm start`).
3. Set `ANTHROPIC_API_KEY` in Railway Variables.
4. Set `NODE_ENV=production`.
5. After deploying the frontend, set `ALLOWED_ORIGINS` to its full Vercel origin, such as `https://readme-forge.vercel.app`. Multiple origins can be comma-separated.
6. Generate a Railway public domain and copy it for the frontend configuration.

Use only Railway's available free/trial allowance and monitor its current limits; plan availability may change.

### Frontend: Vercel

1. Import the same repository into Vercel.
2. Vercel uses `vercel.json` to run the root build and publish `frontend/dist`.
3. Add `VITE_API_BASE_URL` with the Railway API public URL, e.g. `https://readme-forge-api.up.railway.app` — no trailing slash.
4. Deploy, then add the resulting Vercel URL to Railway's `ALLOWED_ORIGINS` and redeploy the backend if necessary.

Vercel environment values prefixed with `VITE_` are bundled into client code. Only the API URL belongs there; never expose `ANTHROPIC_API_KEY`.

## Security and limitations

- This is a demo for public repositories. It does not support GitHub authentication or private repositories.
- Server-side rate limiting, strict CORS, request size limits, security headers, GitHub/Claude timeouts, and context/file-size caps are included.
- Generated text is a draft. Review it for correctness, security claims, licensing, and commands before publishing.
- The backend has an Anthropic API cost associated with its API key. GitHub REST requests are deliberately unauthenticated as requested.

## License

No license has been selected. Add a license file before distributing this project.
