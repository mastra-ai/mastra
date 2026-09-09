# Architecture — Mastra Software Factory

## Package boundary

`@mastra/factory` is the backend core of the Factory product. It is consumed by a host deploy entry (e.g. `mastracode/web`), not run standalone:

```
mastracode/web (host)          →  constructs MastraFactory, calls prepare()/finalize()
mastracode/factory (this pkg)  →  storage domains, routes, rules, integrations, sandbox, agent behavior
mastracode/factory-ui          →  React UI consuming the routes this package mounts
mastracode/sdk                 →  @mastra/code-sdk: agent-controller mount shared with plain Mastra Code
```

`MastraFactory.prepare()` resolves every dependency explicitly and returns the constructor args for `new Mastra(...)` — the host's entry file keeps the literal `export const mastra = new Mastra(...)` because a build-time Babel plugin (`checkConfigExport`) requires finding that literal in the entry AST. `finalize()` runs the post-construct boot: agent-controller init and workers.

## Top-level module map (`src/`)

| Directory | Responsibility |
|---|---|
| `boards/` | Board definitions (`define-board.ts`, `work.ts`, `review.ts`), registry, transition policy, phase semantics |
| `rules/` | Dispatcher (poll/lease/run agents), transition service, tool-result rules, validation, causal-chain types (`types.ts`) |
| `integrations/` | `FactoryIntegration` contract (`base.ts`) + GitHub, Linear, Slack, WorkOS, Platform-flavored implementations |
| `storage/domains/` | One storage class per bounded concern: `work-items`, `projects`, `documents`, `audit`, `intake`, `comments`, `channel-identity`, `credentials`, `custom-providers`, `filesystem`, `memory-settings`, `model-packs`, `queue-health`, `source-control` |
| `routes/` | HTTP contracts (`contracts.ts`) and route assembly (`surface.ts`, `projects.ts`, `tenant-credentials.ts`, `custom-provider-source.ts`) |
| `capabilities/` | Provider-neutral interfaces integrations implement: `intake.ts` (issues/comments), `version-control.ts` (PRs/reviews), `connection.ts` |
| `sandbox/` | Per-project/per-session sandbox lifecycle and retirement |
| `session/` | Session-scoped observers that hydrate a run: filesystem capture, memory-settings hydration, model-pack hydration, thread-title mirror, first-exec/first-message capture |
| `skills/` | Skill/prompt invocation resolution used by board rules (`resolveSkillInvocation`, `resolvePromptInvocation`) |
| `supervisor/` | Health/attention aggregation surfaced to the UI |
| `auth.ts`, `state-signing.ts`, `secret-encryption.ts` | Cross-cutting auth, OAuth state signing, secret-at-rest encryption |
| `factory.ts` | `MastraFactory` — wires all of the above; the only entry point |

## Storage: one backend, many domains

A single `FactoryStorage` instance (Postgres or LibSQL, from `@mastra/core/storage`) backs both the agent runtime (threads/messages/memory — owned by core) and every Factory-specific domain listed above. Each domain is its own class (e.g. `WorkItemsStorage`, `FactoryProjectsStorage`, `FactoryDocumentsStorage`) with its own schema constant and typed row/DTO conversion (`toFactoryProject`, etc.), but all share the same underlying connection the host configures once. This is deliberate: a deployment should not need a second database just to run Factory features.

## Boards: the orchestration core

A **board** (`BoardDefinition`) is a phase graph: each phase has a `kind` (`resting` | `working` | `terminal`), working phases name a `role` (`triage`/`plan`/`work`/`review`), and the board declares its own `transitionPolicy`, lifecycle rules (`onEnter`/`onExit` keyed by source), and tool-result rules (keyed by tool name). `defineBoard()` validates this shape at definition time (`BoardDefinitionError` on violation) — invalid boards fail to boot, not fail at runtime.

Work and Review are built-in boards installed by default; `createBoardRegistry()` assembles the registry from built-ins plus any boards the host config passes, rejecting duplicate/reserved IDs. There is no global `rules` object — every rule is owned by exactly one board (or, for provider events, by the integration that receives them).

## Rules and the dispatcher

`rules/dispatcher.ts` (`FactoryDecisionDispatcher`) is the always-on poll loop: it leases pending work (bounded by `MAX_IN_FLIGHT`), starts or resumes agent runs seated in the phase's role, watches each run to a terminal state via `watchRun()`, retries transient dispatch failures up to `MAX_ATTEMPTS` with backoff, and periodically sweeps for stale bindings and missed reconciliations (`RECONCILE_INTERVAL_MS`). `rules/transition-service.ts` (`FactoryTransitionService`) is the synchronous path: given a requested transition, it resolves the board and phase semantics, evaluates the board's `transitionPolicy`, evaluates the matching lifecycle/tool-result rule, and commits the outcome — recording `configVersion`, the `causalChain`, and idempotency against the triggering `ingress`.

## Integrations

`integrations/base.ts` defines `FactoryIntegration` as the shared contract: a deploy entry constructs concrete instances (GitHub, Linear, Slack, WorkOS, or third-party) with explicit credentials and passes them via `MastraFactoryConfig.integrations`. The factory hands each instance an `IntegrationContext` — auth, sandbox config, scoped storage handles (`generic`, `sourceControl`, `projects`, `memorySettings`, `intake`, `channelIdentity`), and once work items are ready, a `runtime` slice (`configVersion`, `workItems`, `boards`) so integrations can read phase semantics instead of pattern-matching board names. An absent integration means its routes never mount and its tools never register — the server still boots. Two capability interfaces (`capabilities/intake.ts`, `capabilities/version-control.ts`) let an integration declare what it can do (list issues, create PR reviews, etc.) without the core depending on any specific provider's SDK.

## Documents subsystem

`storage/domains/documents/catalog.ts` hardcodes the 14-kind catalog (`FACTORY_DOC_KINDS`) with each kind's group (`ba`/`tech`), label, purpose, and default path under `docs/factory/`. `storage/domains/documents/manifest.ts` parses an optional `docs/factory/manifest.yaml` that remaps kinds to non-default paths, falling back to defaults on a missing or invalid manifest (never failing the sync). On session sandbox materialization, the factory reads the manifest and each catalog kind via `git show` at the checkout's ref and upserts `FactoryDocumentsStorage`. Routes under `/web/factory/projects/:id/documents*` expose the catalog, one document's body, and a manual refresh; `prompt-context.ts` (`FactoryDocsReader`) surfaces the synced set into agent kickoff/prompt context so an agent session and a human reviewer read the same ground truth.

## Auth, signing, secrets

`auth.ts` resolves the caller (`FactoryAuthUser`/`FactoryAuthTenant`) from the host's auth provider through a `RouteAuth` seam every route uses uniformly. `state-signing.ts` provides one `StateSigner` per boot so every integration's OAuth flow signs/verifies state with the same secret. `secret-encryption.ts` provides envelope encryption (`SecretEnvelopeV1`) for provider credentials at rest; a plaintext implementation is available for local/dev via `createPlaintextFactorySecretEncryption`, but production deployments configure a real key.

## Session lifecycle hooks

`session/*.ts` observers attach to agent-controller session events to make a Factory-kicked-off session behave like a normal Mastra Code session: hydrate the project's default memory settings and model pack, capture the first exec/message/filesystem touch for audit, and mirror the thread title. These run regardless of which board/role started the session.
