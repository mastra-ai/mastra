# Runbook / Deployment — Mastra Software Factory

## What deploys

`@mastra/factory` is a library the host's deploy entry consumes — it is not deployed standalone. The pattern (per `factory.ts` header comment and README):

```ts
import { MastraFactory } from '@mastra/factory';
import { Mastra } from '@mastra/core/mastra';

const factory = new MastraFactory({ storage /* ...config */ });
const args = await factory.prepare();
export const mastra = new Mastra(args); // literal required by the build's checkConfigExport check
await factory.finalize(mastra);
```

`prepare()` resolves every dependency and returns constructor args; `finalize()` runs post-construct boot (agent-controller init + workers). The `export const mastra = new Mastra(...)` literal must stay in the entry file for the deploy pipeline's `checkConfigExport` Babel plugin to mark the config valid.

## Required and optional configuration (`MastraFactoryConfig`)

| Field | Required | Default if omitted |
|---|---|---|
| `storage` | **Yes** | none — must be a `FactoryStorage` (`PgFactoryStorage` from `@mastra/pg` or `LibSQLFactoryStorage` from `@mastra/libsql`); backs both agent runtime and app tables |
| `auth` | No | `MastraAuthStudio` (proxies to the shared Mastra platform API via `MASTRA_SHARED_API_URL`/`MASTRA_ORGANIZATION_ID`/`MASTRA_COOKIE_DOMAIN`). Pass `null` to disable auth entirely (open server, local-dev only) |
| `vector` | No | SDK mount's default vector-store resolution |
| `pubsub` | No | in-process default; set for multi-process deployments (e.g. `RedisStreamsPubSub`) so streams/workflows/signals coordinate across processes |
| `publicUrl` | No | `http://localhost:4111`; **must** be the public API origin (not the SPA origin) since it builds integration OAuth/install callback URLs |
| `allowedOrigins` | No | none; set when the SPA is served from a separate static host so credentialed cross-origin requests are allowed |
| `sandbox` | No | repository sandboxes disabled |
| `sandboxStart` | No | `'lazy'` (boots on first command); `'eager'` boots as soon as the session's workspace resolves |
| `dispatcher.maxInFlight` | No | dispatcher default; per-process cap on concurrent background dispatches (not a global cross-deployment limit) |
| `stateSecret` | No | per-process random secret (fine for single-process local dev; **rejected** for integrations declaring `requiresStableStateSigner` in multi-process/restart-prone deployments) |
| `secretEncryption` | Strongly recommended whenever auth is enabled | falls back to explicit plaintext with a boot-time warning |
| `integrations` | No | `[]`; when Platform credentials exist (`MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY`), missing `github`/`linear` default to their Platform-backed implementations |
| `configVersion` | No | `factory-config-v1` |
| `boards` | No | `[]` (only built-ins) |
| `includeDefaultBoards` | No | `true` (Work + Review installed) |
| `platform.githubAppSlug` | No | none; identifies Factory's own GitHub App writes so its own webhook deliveries don't retrigger triage |

## Environment variables read by the factory/host boundary

- `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY` — presence of either enables Platform-backed GitHub/Linear integration defaults.
- `MASTRA_SHARED_API_URL`, `MASTRA_ORGANIZATION_ID`, `MASTRA_COOKIE_DOMAIN` — resolved by `MastraAuthStudio` itself when no explicit `auth` is passed.
- `MASTRA_TELEMETRY_DISABLED=true` — disables authenticated Factory web usage telemetry (account/project/deployment/region attribution) if set on the Factory server.

Per the integration design (`integrations/base.ts` header), integration-specific env vars (GitHub App credentials, Linear API keys, etc.) are read exactly once by the host's deploy entry when constructing that integration instance — never by factory or integration library code directly. Confirm any new deployment's entry file reads its integration credentials there, not inside `@mastra/factory`.

## Startup sequence

1. Host constructs integration instances from env (GitHub, Linear, Slack, WorkOS, or third-party) and passes them in `integrations`.
2. `new MastraFactory({ ...config })` — no I/O yet.
3. `await factory.prepare()` — derives integration readiness from declared capabilities and required storage domains, assembles routes/middleware, returns `MastraArgs`.
4. `export const mastra = new Mastra(args)` — literal, required by the build check.
5. `await factory.finalize(mastra)` — agent-controller init, background workers (including the rules dispatcher) start.

## Operational surfaces

- **Dispatcher health**: `queue-health` storage domain + `GET /web/factory/projects/:id/supervisor/health` and `/health/thresholds` routes surface dispatcher backlog/staleness to the supervisor UI. Investigate a growing backlog by checking `MAX_IN_FLIGHT`/`dispatcher.maxInFlight` against actual concurrent work, and the stale-binding sweep (`STALE_BINDING_SWEEP_INTERVAL_MS` / `STALE_BINDING_TTL_MS`) for leaked bindings.
- **Documents sync**: `POST /web/factory/projects/:id/documents/refresh` re-syncs `docs/factory/*.md` from a live sandbox checkout on demand; normally happens automatically on session sandbox materialization.
- **Decisions inbox**: parked/proposed rule decisions awaiting a human (`decisionList`/`decisionApprove`/`decisionDismiss`/`decisionRetry`) — a growing decision backlog usually means `autoRunEnabled`/`autoApprovePlans` are off for a project that expects hands-off operation, or a recurring rejection code worth investigating via the causal chain on the rejected evaluation.
- **Telemetry**: disable with `MASTRA_TELEMETRY_DISABLED=true` if a deployment must not send usage telemetry.

## Rollback / migration notes

- Board/phase-semantics changes (adding `kind`/`role` to every phase) are the kind of change that requires updating any custom `defineBoard()` calls in the host's entry before deploying a factory version bump — check `CHANGELOG.md` for "Minor Changes" entries with migration snippets before upgrading `@mastra/factory`.
- Storage schema changes are additive (new nullable columns/indexes) — verify a new `@mastra/factory` version's schema changes have run their `ensureCollections` migration path before routing production traffic.
