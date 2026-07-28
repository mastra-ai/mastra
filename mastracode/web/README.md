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

Use this for UI work. Run these in separate terminals:

```shell
pnpm --dir mastracode/web api
```

```shell
pnpm --filter ./mastracode/factory-ui web
```

Open `http://localhost:5173`.

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
