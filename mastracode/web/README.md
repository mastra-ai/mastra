# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub), tenant server, a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../sdk).

This is a **standalone pnpm project** (own lockfile, not a monorepo workspace member). For development, the monorepo-provided packages (`@mastra/*`, `mastra`) are consumed via `link:` specs pointing at the monorepo directories, so you always develop against local source. For builds, `scripts/monorepo-deps.mjs` temporarily pins those deps to the exact versions found in the monorepo (see below).

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
3. `scripts/monorepo-deps.mjs run -- mastra build --dir src/mastra` — pins the `link:` deps to the **exact versions found in the monorepo** (read from each linked package's `package.json`), runs the build, then always restores the `link:` specs (also on failure/Ctrl-C). The build bundles the API server to `.mastra/output/` and copies `public/` (including the SPA) into it automatically.
4. The server serves the SPA same-origin at `/` (see `src/web/spa-static.ts`).

The deploy output's `package.json` therefore pins the exact monorepo versions of `@mastra/*`, so a production deploy `npm install`s them straight from npm — those versions must be published (CI releases alphas). **Known limitation:** until `@mastra/code-sdk` has a proper npm release (changeset queued), the build's final output-deps install step fails on `@mastra/code-sdk@0.0.0`; the bundle, SPA, and output `package.json` are still produced correctly before that step.

To switch the manifest manually: `pnpm deps:pin` / `pnpm deps:link` (the `link:` state is what's committed).

Run the output with `pnpm web:start` (or `node .mastra/output/index.mjs` after installing output deps).

To deploy to Mastra Cloud:

```bash
pnpm web:deploy
```

This runs `web:build` (pinned versions, as above) and then `mastra deploy --skip-build`, which uploads the existing `.mastra/output`. Deploy targets `--env production` by default and auto-selects `.env.production` if present — otherwise it will offer to upload vars from the local `.env`, so double-check what you confirm in the prompt. Requires `mastra auth login` first; pass extra flags via `pnpm web:deploy -- --env staging` etc.

## Tests

```bash
pnpm web:test     # server scenario tests (e2e/web)
pnpm web:ui:test  # UI MSW tests (e2e/web-ui)
```

## Environment

See `.env.schema` (package root; varlock validates `.env` against it). Minimum: none (runs auth-less, local-only). Auth needs `WORKOS_*`; GitHub needs `GITHUB_APP_*` + auth + `APP_DATABASE_URL`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls both the WorkOS (`/auth/callback`) and GitHub App (`/auth/github/callback`) redirect URLs.
