# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub), tenant server, a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../core).

This is a **standalone pnpm project** (own lockfile, not a monorepo workspace member). Monorepo packages are consumed via `link:` dependencies.

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

- API server (`mastra dev`) on **:4111**, env loaded/validated by varlock from `src/web/.env` against `src/web/.env.schema`.
- Vite SPA on **:5173**, proxying `/api`, `/web`, and `/auth/` to the API server.

For the GitHub/sandbox features, start the app database first: `pnpm web:dev:github` (Postgres via docker compose on :54329).

## Build & deploy

```bash
pnpm web:build
```

1. `prebuild` — builds the linked monorepo packages via turbo.
2. Vite builds the SPA to `dist/web/ui/`.
3. `mastra build --dir src/mastra` bundles the API server to `.mastra/output/`.
4. The SPA is copied to `.mastra/output/ui` and served same-origin at `/`.

The deploy output's `package.json` lists `@mastra/code-sdk` (and the other `@mastra/*` packages) at the versions of the linked workspace packages. **A production deploy `npm install`s from npm, so `@mastra/code-sdk` must be published at (or compatible with) the linked version** — release via changesets before deploying.

Run the output with `pnpm web:start` (or `node .mastra/output/index.mjs` after installing output deps).

## Tests

```bash
pnpm web:test     # server scenario tests (e2e/web)
pnpm web:ui:test  # UI MSW tests (e2e/web-ui)
```

## Environment

See `src/web/.env.schema` and `src/web/.env.example`. Minimum: none (runs auth-less, local-only). Auth needs `WORKOS_*`; GitHub needs `GITHUB_APP_*` + auth + `APP_DATABASE_URL`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls both the WorkOS (`/auth/callback`) and GitHub App (`/auth/github/callback`) redirect URLs.
