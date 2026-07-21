# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub/Linear), a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../sdk). One factory storage backend persists agent state (threads, messages, and memory) and web app data. When `APP_DATABASE_URL` is set, a separate `PgVector` uses the same PostgreSQL database for recall search; explicit local development and test runs use the SDK's local LibSQL database without vector storage.

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

## Factories, bindings, and repositories

In the Web UI a **Factory** is the top-level product entity the user creates and selects. Each Factory has a browser-owned identity (`Factory.id`) and a single **binding**:

- **Local folder** — path on the host machine; sessions use the resolved `resourceId` from `GET /web/codebase/resolve`.
- **Connected GitHub repository** — org-owned row in `github_projects`, identified by `githubProjectId` / `github_project_id` at the persistence boundary.

Board, metrics, audit, sandboxes, worktrees, and PR subscriptions stay **repository-scoped** via `githubProjectId`. A Factory is not a multi-repository aggregate, and there is no server-side `factories` table yet. GitHub-backed Factories can use the Factory Board; local Factories are still Factories, but Board/metrics/audit require a GitHub connection.

Session continuity with the TUI intentionally keeps the SDK names `projectPath` and `detectProject`. Those refer to the execution workspace path / codebase detection protocol, not the product Factory entity. Private HTTP routes use precise nouns: `/web/codebase/resolve`, `/web/github/repositories/*`, `/web/factory/repositories/:id/*`.

Intake source config is asymmetric by provider: GitHub selections are `repositoryIds` (connected repository UUIDs); Linear selections remain `projectIds` because Linear Project is an external provider concept.

Browser state uses `mastracode-factories` / `mastracode-active-factory` only. Prerelease `mastracode-projects` keys are not read.

## Workspace skill invocation

The private Web API can activate a user-invocable skill on an existing scoped AgentController session with `POST /web/agent-controller/:controllerId/skills/invoke`. The Web Factory packages workflow skills such as `understand-issue` and `understand-pr` as ordinary, read-only `SKILL.md` files and adds them only to workspaces created by `MastraFactory`; the shared SDK and TUI workspace resolver do not load them. The route resolves every ID through the session workspace, uses the same `<skill name="…">` activation envelope as `/skill/<name>` in the TUI, and returns an error without dispatching when the skill is missing. Authenticated requests may target only the caller's personal session or a Factory worktree owned by that organization user.

## Factory Overview

For GitHub projects with a connected repo, the sidebar Factory section leads with an **Overview** tab (`/factory/overview`, above Board) — the factory's at-a-glance landing page. Its centerpiece is the **Queue Health Chart**: one horizontal bar per stage (intake → triage → planning → execute → review), segmented by task age (green / amber / orange / red, proportional to count) with a diagonal-stripe overlay on the portion where agent work is actively running. Clicking a segment filters a drill-down task list below the chart. Age comes from each item's open `stageHistory` entry (falling back to `createdAt`); the active signal reuses the same `useWorkspaceActivity` worktree-activity poll that drives the sidebar dots. Aggregation runs client-side via the pure `computeQueueHealth()` (`src/web/ui/domains/factory/queue-health.ts`).

The age thresholds are server-side, per-project config (seconds), served by `GET /web/factory/repositories/:id/health/thresholds` and stored in the `queue-health` factory storage domain (`queue_health_settings` table) keyed by `(org_id, github_project_id)`. Defaults are `[14400, 86400, 259200]` (4h / 24h / 72h); `saveConfig` rejects a non-ascending or empty `thresholdsSeconds`. Thresholds live in seconds so fast-moving automated flows can represent sub-minute buckets.

## GitHub pull request notifications

GitHub-backed Factory sessions automatically subscribe the current thread after a successful `gh pr create`. The `github_subscribe_pr` tool is primarily for existing pull requests or recovery when automatic subscription did not occur. Use `github_unsubscribe_pr` only to stop notifications early; closing or merging the pull request retires its subscription automatically.

Configure the GitHub App webhook URL as `https://your-host/web/github/webhook`, set `GITHUB_APP_WEBHOOK_SECRET` to the same secret configured in GitHub, and subscribe the App to pull request, pull request review, pull request review comment, and issue comment events. Comments and reviews are delivered only when their author has write access or is an explicitly authorized bot.

## Environment

See `.env.schema` (package root; varlock validates `.env` against it). Local development needs no variables and runs auth-less with local LibSQL storage; non-local deployments require `APP_DATABASE_URL`. WorkOS auth requires both `WORKOS_API_KEY` and `WORKOS_CLIENT_ID`; alternatively set `BETTER_AUTH_SECRET`. GitHub needs the complete `GITHUB_APP_*` group plus auth; Linear needs `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls the WorkOS (`/auth/callback`), GitHub App (`/auth/github/callback`), and Linear callback URLs.
