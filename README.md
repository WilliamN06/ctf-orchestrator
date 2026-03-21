# CTF Orchestrator

A full-stack Capture The Flag competition platform built on Cloudflare's Agents SDK.

Each challenge runs as its own Durable Object — persistent state, real-time WebSocket scoreboard, and an AI hint agent powered by Workers AI. Zero infrastructure to manage.

## Stack

- **Backend** — Cloudflare Workers + Agents SDK
- **State** — Durable Objects with built-in SQLite
- **Real-time** — WebSocket via CompetitionAgent
- **AI hints** — Workers AI (llama-3.1-8b) via AIChatAgent
- **Frontend** — React + Vite

## Getting Started

```bash
# Clone
git clone https://github.com/WilliamN06/ctf-orchestrator
cd ctf-orchestrator

# Install backend deps
npm install

# Install frontend deps
cd frontend && npm install && cd ..

# Run locally (backend on :8787, frontend on :5173)
npx wrangler dev
cd frontend && npm run dev
```

## Deploy

```bash
# Backend
npx wrangler deploy

# Frontend
cd frontend && npm run build
npx wrangler pages deploy dist --project-name ctf-orchestrator-ui
```

## How it works

| Component | Role |
|---|---|
| `ChallengeAgent` | One Durable Object per challenge — tracks solves, attempts, hints per team in SQLite |
| `CompetitionAgent` | Single DO for the competition — scoreboard, team registration, WebSocket broadcast, cron auto-close |
| `HintAgent` | AIChatAgent per team per challenge — Workers AI with flag-leak prevention built into the system prompt |
| `src/index.js` | Worker entry point — all REST routing and flag validation |

## License

MIT