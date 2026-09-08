# MastraCode web host

`mastracode/web` wires environment-specific storage, authentication, integrations, event bus, and sandboxes into [`@mastra/factory`](../factory/README.md). React code belongs in [`factory-ui`](../factory-ui/README.md).

This is a separate pnpm project with its own lockfile and `link:` dependencies to monorepo packages.

## Setup

From the repository root:

```shell
pnpm install
pnpm --dir mastracode/web install
pnpm --dir mastracode/web run prebuild
```

`prebuild` builds the linked packages required by the host.

## Development

Local development uses LibSQL and local sandboxes. Onboarding requires sign-in and a GitHub App.

### Configure local onboarding

Create a [GitHub App](https://github.com/settings/apps/new) with URLs matching the mode you will run:

| Setting      | Integrated mode                              | Split UI mode                                |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| Homepage URL | `http://localhost:5873`                      | `http://localhost:5173`                      |
| Callback URL | `http://localhost:5873/auth/github/callback` | `http://localhost:5173/auth/github/callback` |
| Setup URL    | `http://localhost:5873/auth/github/callback` | `http://localhost:5173/auth/github/callback` |

Do not mix modes. Nothing runs on port `5173` in integrated mode.

Configure the app:

1. Grant **Contents**, **Issues**, and **Pull requests** read/write access and **Metadata** read-only access.
2. Clear **Webhook → Active** for local development.
3. Generate a client secret and private key.
4. Add these values to `mastracode/web/.env`:

```dotenv
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_SLUG=
GITHUB_APP_WEBHOOK_SECRET=
```

Generate the state-signing secret with `openssl rand -hex 32` and use it for `GITHUB_APP_WEBHOOK_SECRET`. Use escaped `\n` characters in the private key. Restart the server after changing `.env`.

See [`.env.schema`](./.env.schema) for other environment variables.

### Integrated mode

Use this for backend work and production-like checks:

```shell
pnpm --dir mastracode/web dev
```

Open `http://localhost:5873`.

### Split UI mode

Use this for UI work. One command starts the Docker services, builds the
workspace packages the UI depends on, then runs the API on :4111 and Vite on
:5173:

```shell
pnpm --dir mastracode/web dev:ui
```

Open `http://localhost:5173`. To restart one side without losing the other,
start the Docker services with `pnpm --dir mastracode/web db:up`, then run
`pnpm --dir mastracode/web api` and `pnpm --filter ./mastracode/factory-ui dev`
in separate terminals.

### Slack channels (optional)

Slack sends events to public HTTPS origins only, so a local server needs a
tunnel. The steps below assume integrated mode, where the server listens on
`5873`. Install [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
(`brew install cloudflared`).

#### 1. Start a tunnel

```shell
cloudflared tunnel --url http://127.0.0.1:5873
```

Any HTTPS tunnel can be used. The command above starts a temporary Cloudflare
Quick Tunnel without an account or config file. Keep it running and copy the
`trycloudflare.com` hostname it prints; that hostname is valid until you stop
the command.

If you have a Cloudflare account and a domain, use a named tunnel with a stable
hostname instead. Then the Slack manifest can keep the same public URL across
local restarts instead of being updated for every new Quick Tunnel hostname.

#### 2. Create the Slack app

Generate a manifest for the tunnel URL:

```shell
pnpm --dir mastracode/web slack:manifest \
  --url https://your-tunnel-hostname \
  --name "Mastra Factory (dev)" \
  --copy
```

At [api.slack.com/apps](https://api.slack.com/apps), choose **Create New App →
From a manifest** and paste the manifest from your clipboard.

Install it to your workspace. Copy the app credentials from **Basic Information → App Credentials** and the bot token from **OAuth & Permissions** into `.env`:

```dotenv
MASTRACODE_CHANNELS_PUBLIC_URL=https://your-tunnel-hostname
SLACK_APP_SIGNING_SECRET=
SLACK_APP_CLIENT_ID=
SLACK_APP_CLIENT_SECRET=
SLACK_APP_BOT_TOKEN=
```

Restart the dev server — varlock reads `.env` at startup.

#### 3. Link your account

DM the bot. It replies with a Connect card; that flow binds your Slack identity
to your Mastra user, and messages then run as you.

A quick tunnel gets a new hostname each run. When it changes, replace the
hostname in `MASTRACODE_CHANNELS_PUBLIC_URL` and in the Slack app's **Event
Subscriptions**, **Interactivity & Shortcuts**, and **OAuth & Permissions** settings.

### Optional local services

To test PostgreSQL and Redis:

```shell
pnpm --dir mastracode/web db:up
```

Add these values to `mastracode/web/.env` and restart the server:

```dotenv
DATABASE_URL=postgres://user:pass@localhost:54329/mastracode_web
REDIS_URL=redis://localhost:63799
```

## Tests

```shell
pnpm --dir mastracode/web test
pnpm --dir mastracode/web check
```

UI tests live in `factory-ui`; backend tests live in `factory`.

## Build and run

```shell
pnpm --dir mastracode/web build
pnpm --dir mastracode/web start
```

## Deploy

```shell
mastra auth login
pnpm --dir mastracode/web deploy
```
