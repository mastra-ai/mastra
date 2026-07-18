# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub/Linear), a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../sdk). One factory storage backend persists both agent state (threads, messages, memory, recall vectors) and web app data. The deploy entry uses PostgreSQL when `APP_DATABASE_URL` is set and otherwise reuses the SDK's local LibSQL database.

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

Local development works without PostgreSQL: the full web surface uses the SDK's local LibSQL database. To exercise the PostgreSQL backend and distributed-lock path, run `pnpm web:dev:github` (Docker Compose on port 54329).

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

This runs `web:build` (pinned versions, as above), validates the output (server entry, deploy manifest, SPA), and then `mastra deploy --skip-build`, which uploads the existing `.mastra/output`. Deploy targets `--env production` by default and auto-selects `.env.production` if present — otherwise it will offer to upload vars from the local `.env`, so double-check what you confirm in the prompt. Requires `mastra auth login` first; pass extra flags via `pnpm web:deploy -- --env staging` etc.

## Tests

```bash
pnpm web:test     # server scenario tests (e2e/web)
pnpm web:ui:test  # UI MSW tests (e2e/web-ui)
```

## Workspace skill invocation

The private Web API can activate a user-invocable skill on an existing scoped AgentController session with `POST /web/agent-controller/:controllerId/skills/invoke`. The Web Factory packages workflow skills such as `understand-issue` and `understand-pr` as ordinary, read-only `SKILL.md` files and adds them only to workspaces created by `MastraFactory`; the shared SDK and TUI workspace resolver do not load them. The route resolves every ID through the session workspace, uses the same `<skill name="…">` activation envelope as `/skill/<name>` in the TUI, and returns an error without dispatching when the skill is missing. Authenticated requests may target only the caller's personal session or a Factory worktree owned by that organization user.

## GitHub pull request notifications

GitHub project sessions automatically subscribe the current thread after a successful `gh pr create`. The `github_subscribe_pr` tool is primarily for existing pull requests or recovery when automatic subscription did not occur. Use `github_unsubscribe_pr` only to stop notifications early; closing or merging the pull request retires its subscription automatically.

Configure the GitHub App webhook URL as `https://your-host/web/github/webhook`, set `GITHUB_APP_WEBHOOK_SECRET` to the same secret configured in GitHub, and subscribe the App to pull request, pull request review, pull request review comment, and issue comment events. Comments and reviews are delivered only when their author has write access or is an explicitly authorized bot.

## Environment

See `.env.schema` (package root; varlock validates `.env` against it). Minimum: none (runs auth-less with local LibSQL storage). Set `APP_DATABASE_URL` to use PostgreSQL instead. Auth needs `WORKOS_*` or `BETTER_AUTH_SECRET`; GitHub needs the complete `GITHUB_APP_*` group plus auth; Linear needs `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls the WorkOS (`/auth/callback`), GitHub App (`/auth/github/callback`), and Linear callback URLs.
