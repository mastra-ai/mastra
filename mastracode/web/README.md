# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub), tenant server, a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../sdk).

This is a **standalone pnpm project** (own lockfile, not a monorepo workspace member). `@mastra/*` packages are consumed from the npm registry (snapshot releases for unpublished work).

## Setup

```bash
# from the monorepo root
pnpm install

# in mastracode/web
pnpm install
```

## Development

```bash
pnpm web:dev
```

- API server (`mastra dev`) on **:4111**, env loaded/validated by varlock from `.env` against `.env.schema` (package root).
- Vite SPA on **:5173**, proxying `/api`, `/web`, and `/auth/` to the API server.

For the GitHub/sandbox features, start the app database first: `pnpm web:dev:github` (Postgres via docker compose on :54329).

## Build & deploy

```bash
pnpm web:build
```

1. `prebuild` — builds the linked monorepo packages via turbo.
2. Vite builds the SPA to `src/mastra/public/ui/`.
3. `mastra build --dir src/mastra` bundles the API server to `.mastra/output/` and copies `public/` (including the SPA) into it automatically.
4. The server serves the SPA same-origin at `/` (see `src/web/spa-static.ts`).

The deploy output's `package.json` lists `@mastra/code-sdk` (and the other `@mastra/*` packages) at the installed registry versions, so a production deploy `npm install`s them straight from npm. To pick up unpublished work, release (snapshot) via changesets first and bump the versions here.

Run the output with `pnpm web:start` (or `node .mastra/output/index.mjs` after installing output deps).

## Tests

```bash
pnpm web:test     # server scenario tests (e2e/web)
pnpm web:ui:test  # UI MSW tests (e2e/web-ui)
```

## Environment

See `.env.schema` (package root; varlock validates `.env` against it). Minimum: none (runs auth-less, local-only). Auth needs `WORKOS_*`; GitHub needs `GITHUB_APP_*` + auth + `APP_DATABASE_URL`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls both the WorkOS (`/auth/callback`) and GitHub App (`/auth/github/callback`) redirect URLs.
