# Mastra Factory

An open source, agent-powered software delivery environment built on [Mastra](https://mastra.ai). Connect GitHub and Linear, pull issues into an intake board, hand them to coding agents, and ship pull requests — from a web app you own and can deploy anywhere.

Created with [`npm create factory`](https://www.npmjs.com/package/create-factory).

## Quick start

```bash
npm install

# optional: local Postgres (+pgvector) & Redis via Docker
npm run db:up

npm run dev
```

- **Factory UI** → http://localhost:4111
- **API** → http://localhost:4111/api

One server serves both the UI and the API.

With zero configuration the app runs in local, auth-less mode (agents + local storage, no integrations). Open the Factory UI to finish setup — model provider keys are added there (Settings › Models). Deployment-level features enable themselves as you add environment variables — see below.

### Ports

The server port is overridable with `PORT`. OAuth callback URLs (WorkOS/GitHub/Linear) are registered against the configured origin, so if you change the port, also set `MASTRACODE_PUBLIC_URL=http://localhost:<port>` in `.env` (then update the callback URLs on your OAuth apps).

## Configuration

Day-to-day configuration (model providers, integrations) happens in the web UI. Deployment-level settings live in `.env` (validated against `.env.schema` by [varlock](https://varlock.dev)). Every value is optional; each feature activates when its variables are set. Restart `npm run dev` after changing `.env`.

| Feature                  | Requires                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agents / model providers | add keys in the UI (Settings › Models), or `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`                                                                   |
| Sign-in (WorkOS)         | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`                                                                                                                |
| GitHub projects & intake | WorkOS + `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` + `APP_DATABASE_URL`      |
| Linear intake            | WorkOS + `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` + `APP_DATABASE_URL` + a state secret (`GITHUB_APP_WEBHOOK_SECRET` or `WORKOS_COOKIE_PASSWORD`) |
| Distributed event bus    | `REDIS_URL` (only needed for multi-process deployments)                                                                                             |
| Cloud sandboxes          | `RAILWAY_API_TOKEN` (defaults to a local git sandbox otherwise)                                                                                     |

### Database

Integrations and shared agent state need Postgres **with the pgvector extension**. Two easy options:

- **Local Docker** (recommended to start): `npm run db:up` starts Postgres on `localhost:54329` matching `APP_DATABASE_URL=postgres://user:pass@localhost:54329/mastracode_web` (plus Redis on `localhost:63799`).
- **Hosted Postgres**: any provider works if pgvector is available (Neon, Supabase, Railway, RDS, ...) — enable the extension and set `APP_DATABASE_URL`.

Without `APP_DATABASE_URL`, agent state falls back to a local libSQL file and integrations stay off.

### Sign-in (WorkOS)

Integrations are per-organization, so they require sign-in, powered by [WorkOS](https://workos.com) (free tier is fine):

1. Create a WorkOS project → copy the **API key** and **Client ID** into `.env`.
2. In WorkOS → Redirects, add `http://localhost:4111/auth/callback`.
3. Set `WORKOS_COOKIE_PASSWORD` to a random 32+ character string.

### GitHub

The Factory connects to GitHub through a GitHub App you own. Create an app at https://github.com/settings/apps/new (or under your org) and set the `GITHUB_APP_*` variables in `.env`.

The app needs **Contents, Issues, Pull requests** (Read & write) and **Metadata** (Read-only) permissions. Set its callback URL to `<your app origin>/auth/github/callback`.

Webhooks (optional — powers auto-triage and PR notifications, requires a public host; GitHub rejects localhost webhook URLs): in the App settings, set the webhook URL to `https://<public-host>/web/github/webhook` with the `GITHUB_APP_WEBHOOK_SECRET` from `.env` as the secret, activate it, and subscribe to the **issues, issue_comment, pull_request, pull_request_review, pull_request_review_comment** events. Local development works without webhooks; issues are fetched on demand.

### Linear (optional)

Create a Linear OAuth app (Linear → Settings → API → OAuth applications → New) with callback URL `<your app origin>/auth/linear/callback`, then set `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` in `.env`.

## Scripts

| Script                      | What it does                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`               | Factory server (:4111) serving the UI and the API                                   |
| `npm run db:up` / `db:down` | Start/stop local Postgres + Redis (Docker)                                          |
| `npm run build`             | Build the SPA and bundle the server to `.mastra/output`                             |
| `npm run start`             | Run the production build                                                            |
| `npm run deploy`            | Build and deploy to [Mastra Cloud](https://mastra.ai/docs/mastra-platform/overview) |
| `npm run check`             | Typecheck server and UI                                                             |

`mastra build` and `mastra deploy` detect the Factory entry automatically and build the SPA (Vite) before bundling. The SPA is copied to `.mastra/output/factory/` and a `mastra-project.json` manifest is emitted alongside it.

## Requirements

- Node.js ≥ 22.19
- Docker (optional, for the local database)
- Postgres 15+ with pgvector (for integrations)

## Versions

The Mastra packages are pinned to `alpha`, so `npm install` pulls the current published prerelease. Upgrade them together by re-running `npm install` (or by rescaffolding).

The included `.npmrc` sets `legacy-peer-deps=true` so npm accepts the internally-consistent prerelease peer graph; you can delete it once the packages ship stable releases.

## License

Apache-2.0
