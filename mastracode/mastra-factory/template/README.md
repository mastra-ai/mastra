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
| Sign-in (WorkOS)         | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `FACTORY_CREDENTIAL_ENCRYPTION_KEY`                                                                           |
| GitHub projects & intake | WorkOS + `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` + `APP_DATABASE_URL`      |
| Linear intake            | WorkOS + `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` + `APP_DATABASE_URL` + a state secret (`GITHUB_APP_WEBHOOK_SECRET` or `WORKOS_COOKIE_PASSWORD`) |
| Slack channels           | `SLACK_APP_SIGNING_SECRET`, `SLACK_APP_BOT_TOKEN`, `SLACK_APP_CLIENT_ID`, `SLACK_APP_CLIENT_SECRET` + WorkOS + a state secret (see above)           |
| Distributed event bus    | `REDIS_URL` (only needed for multi-process deployments)                                                                                             |
| Cloud sandboxes          | `MASTRA_PLATFORM_SECRET_KEY`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID` (defaults to a local git sandbox otherwise)                              |

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
4. Generate a deployment-stable credential encryption key with `openssl rand -base64 32` and set it as `FACTORY_CREDENTIAL_ENCRYPTION_KEY`.

Keep the encryption key outside the database and stable across replicas and deploys. Losing it makes stored model-provider keys, custom-provider API keys, GitHub PATs, and integration OAuth tokens unreadable. To rotate it, set a new `FACTORY_CREDENTIAL_ENCRYPTION_KEY` and `FACTORY_CREDENTIAL_ENCRYPTION_KEY_ID`, then provide the old key in `FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS` as a JSON object such as `{"v1":"<old-base64-key>"}`. Factory rewrites legacy plaintext and old-key ciphertext with the primary key during startup and reads.

### GitHub

The Factory connects to GitHub through a GitHub App you own. Create an app at https://github.com/settings/apps/new (or under your org) and set the `GITHUB_APP_*` variables in `.env`.

The app needs **Contents, Issues, Pull requests** (Read & write) and **Metadata** (Read-only) permissions. Set its callback URL to `<your app origin>/auth/github/callback`.

Webhooks (optional — powers auto-triage and PR notifications, requires a public host; GitHub rejects localhost webhook URLs): in the App settings, set the webhook URL to `https://<public-host>/web/github/webhook` with the `GITHUB_APP_WEBHOOK_SECRET` from `.env` as the secret, activate it, and subscribe to the **issues, issue_comment, pull_request, pull_request_review, pull_request_review_comment** events. Local development works without webhooks; issues are fetched on demand.

### Linear (optional)

Create a Linear OAuth app (Linear → Settings → API → OAuth applications → New) with callback URL `<your app origin>/auth/linear/callback`, then set `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` in `.env`.

### Slack (optional)

Talk to the Factory from Slack threads. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with:

- **Event Subscriptions** request URL: `<your app origin>/api/agent-controllers/mastra-code/channels/slack/webhook` (subscribe to bot events for messages and mentions)
- **OpenID Connect** redirect URL: `<your app origin>/connect/slack/oidc/callback` (used to link Slack users to their Factory accounts)

Install it to your workspace, then copy the credentials into `.env`: `SLACK_APP_SIGNING_SECRET` and the client ID/secret from **Basic Information**, and `SLACK_APP_BOT_TOKEN` from **OAuth & Permissions**.

Slack only delivers events to public HTTPS origins, so local development needs a tunnel (e.g. `cloudflared tunnel --url http://127.0.0.1:4111`); set `MASTRACODE_CHANNELS_PUBLIC_URL` to the tunnel origin.

## Scripts

| Script                      | What it does                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`               | Factory server (:4111) serving the UI and the API                                   |
| `npm run db:up` / `db:down` | Start/stop local Postgres + Redis (Docker)                                          |
| `npm run build`             | Bundle the server and copy the CLI-bundled Factory UI to `.mastra/output`           |
| `npm run start`             | Run the production build                                                            |
| `npm run deploy`            | Build and deploy to [Mastra Cloud](https://mastra.ai/docs/mastra-platform/overview) |
| `npm run check`             | Typecheck the Factory server                                                        |

`mastra build` and `mastra deploy` detect the Factory entry automatically and copy the versioned Factory UI bundled with the Mastra CLI while bundling the server. The SPA is written to `.mastra/output/factory/` and a `mastra-project.json` manifest is emitted alongside it.

## Requirements

- Node.js ≥ 22.19
- Docker (optional, for the local database)
- Postgres 15+ with pgvector (for integrations)

## Versions

The Mastra packages are pinned to `latest`, so `npm install` pulls the current published set. Upgrade them together by re-running `npm install` (or by rescaffolding).

## License

Apache-2.0
