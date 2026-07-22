# mastracode-web

The Mastra Code web surface: API routes (config/fs/GitHub/Linear), a deployable Mastra entry (`src/mastra/index.ts`), and the SPA UI. Built on [`@mastra/code-sdk`](../sdk). One factory storage backend persists agent state (threads, messages, and memory) and web app data. When `DATABASE_URL` is set, a separate `PgVector` uses the same PostgreSQL database for recall search; explicit local development and test runs use the SDK's local LibSQL database without vector storage. (`APP_DATABASE_URL` is honored as a deprecated fallback.)

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

In the Web UI, a **Factory** is the top-level product entity that a user creates and selects. Each Factory has one binding:

- **Local folder**: A path on the host machine. Sessions use the `resourceId` resolved by `GET /web/codebase/resolve`.
- **Server Factory**: A persisted Factory project identified by `factoryProjectId`. It can contain one or more connected repositories. Repository-specific operations use each repository's `projectRepositoryId`.

Factory work items belong to the Factory project. Sandboxes, worktrees, GitHub issue and pull request feeds, and pull request subscriptions belong to a connected repository. Private HTTP routes reflect that split. Work items use `/web/factory/projects/:factoryProjectId/*`, while GitHub provider operations use `/web/github/projects/:projectRepositoryId/*`.

Session continuity with the terminal user interface (TUI) keeps the Software Development Kit (SDK) names `projectPath` and `detectProject`. These names refer to the execution workspace path and codebase detection protocol, not the Factory product entity.

Intake source config is asymmetric by provider. GitHub selections use `repositoryIds`, which contain connected repository UUIDs. Linear selections use `projectIds` because a Linear Project is an external provider concept.

Browser state uses `mastracode-factories` and `mastracode-active-factory`. Prerelease `mastracode-projects` keys aren't read.

## Work and Review workflows

Server-backed Factories split repository work across two boards:

- **Work** (`/factory/work`): Shows manual work items, GitHub issues, and Linear issues. Its stages are **Intake**, **Triage**, **Planning**, **Building**, **Review**, and **Done**.
- **Review** (`/factory/review`): Shows GitHub pull requests only. Its stages are **Intake**, **Reviewing**, and **Done**.

Open GitHub issues appear as **Work** intake candidates. Open pull requests appear as **Review** intake candidates. Adding a candidate to a board creates or updates its persisted Factory work item. The source type determines which board owns that item, so a GitHub issue can't appear on **Review** and a pull request can't appear on **Work**.

When a Factory pull request branch matches a related work session branch, the Review item stores the Work item as its parent. The Work card links to the Review session, and the Review card links back to the Work session. The same reciprocal links appear in the session header. Links to a thread are shown only while its referenced worktree still exists; the related board item remains available after worktree deletion.

### Session task and workspace context

Desktop server-backed Factory sessions share one right-side context panel with `Task` and `Files` tabs. `Task` resolves the session's exact Factory run binding, reads the linked GitHub issue, GitHub pull request, or Linear issue on demand, and shows its title, markdown description, state, labels, assignees, and source link. If the provider is disconnected or unavailable, the panel keeps the stored Factory task title and safe link visible. Refresh is manual; task context does not poll or refetch on window focus or reconnect. `Files` continues to use the existing workspace artifact viewer. Personal sessions and local Factories remain Files-only.

## Workspace skill invocation

The private Web API can activate a user-invocable skill on an existing scoped AgentController session with `POST /web/agent-controller/:controllerId/skills/invoke`. The Web Factory packages workflow skills such as `understand-issue` and `understand-pr` as ordinary, read-only `SKILL.md` files and adds them only to workspaces created by `MastraFactory`; the shared SDK and TUI workspace resolver do not load them. The route resolves every ID through the session workspace, uses the same `<skill name="…">` activation envelope as `/skill/<name>` in the TUI, and returns an error without dispatching when the skill is missing. Authenticated requests may target only the caller's personal session or a Factory worktree owned by that organization user.

## Factory metrics

The **Metrics** page at `/factory/metrics` shows queue health for the active Factory. The Queue Health Chart contains one horizontal bar per Work stage. Each bar is segmented by item age and overlays diagonal stripes where agent work is active. Selecting a segment filters the item list below the chart. Age comes from the open `stageHistory` entry and falls back to `createdAt`. The pure `computeQueueHealth()` function in `src/web/ui/domains/factory/queue-health.ts` performs the client-side aggregation.

Queue age thresholds are server-side Factory project config in seconds. `GET /web/factory/projects/:factoryProjectId/health/thresholds` reads them from the `queue-health` storage domain. The `queue_health_settings` table keys records by `(org_id, factory_project_id)`. Defaults are `[14400, 86400, 259200]` (4h, 24h, and 72h). `saveConfig` rejects empty or non-ascending `thresholdsSeconds` values.

## Factory rules

`MastraFactory` accepts one authoritative `rules` tree for Work and Review stage entry and exit, completed tool results, and normalized GitHub events. Construct it with `defaultFactoryRules()` so every deployment policy has an explicit version:

```ts
import { MastraFactory } from './src/web/factory-entry.js';
import { defaultFactoryRules } from './src/web/factory/rules/index.js';

const rules = defaultFactoryRules({
  version: '2026-07-18.1',
  overrides: {
    review: {
      intake: {
        pullRequest: {
          onEnter: context =>
            context.actor.type === 'github' && !context.actor.trusted
              ? { type: 'reject', code: 'forbidden', reason: 'A trusted author is required.' }
              : undefined,
        },
      },
    },
    tools: {
      submit_plan: {
        onResult: () => undefined,
      },
    },
  },
});

const factory = new MastraFactory({ rules });
```

Overrides replace the exact `onEnter`, `onExit`, `onResult`, or `onEvent` leaf; they never compose implicitly with another handler. The version is configuration identity for persisted evaluations and audits, not an event-deduplication key, and Mastra never hashes function source.

Rules are trusted deployment code. They receive normalized, bounded context rather than storage handles, credentials, worktree paths, or raw webhook payloads. Each handler returns one bounded `FactoryRuleDecision` or `void`: a typed rejection, transition, linked-item upsert, skill invocation, bound-session message, or notification. Every returned decision is validated and redacted before persistence; external effects are deferred rather than executed inside rule evaluation.

## GitHub pull request notifications

GitHub-backed Factory sessions automatically subscribe the current thread after a successful `gh pr create`. The `github_subscribe_pr` tool is primarily for existing pull requests or recovery when automatic subscription did not occur. Use `github_unsubscribe_pr` only to stop notifications early; closing or merging the pull request retires its subscription automatically.

Configure the GitHub App webhook URL as `https://your-host/web/github/webhook`, set `GITHUB_APP_WEBHOOK_SECRET` to the same secret configured in GitHub, and subscribe the App to pull request, pull request review, pull request review comment, and issue comment events. Comments and reviews are delivered only when their author has write access or is an explicitly authorized bot.

## Environment

See `.env.schema` (package root; varlock validates `.env` against it). Local development needs no variables and runs auth-less with local LibSQL storage; non-local deployments require `DATABASE_URL` (or the deprecated `APP_DATABASE_URL`). WorkOS auth requires both `WORKOS_API_KEY` and `WORKOS_CLIENT_ID`; alternatively set `BETTER_AUTH_SECRET`. GitHub needs the complete `GITHUB_APP_*` group plus auth; Linear needs `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET`; Railway sandboxes need `RAILWAY_API_TOKEN`. `MASTRACODE_PUBLIC_URL` controls the WorkOS (`/auth/callback`), GitHub App (`/auth/github/callback`), and Linear callback URLs.
