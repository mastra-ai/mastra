# PR #19338 — Understand History & Context

Author: `tiffanybalc` (community; 2 merged PRs; opened linked issue #19247)
Reviewer: `rphansen91`
Branch: `feat/provider-aware-fga-actor-authorizer` @ 2fc7300f70
Base: `main`
Complexity label: critical
Changesets: `@mastra/core` minor + patch, `@mastra/server` patch — present.

## Goal (Phase 1 recap)

Close FGA gap for **system (non-user) actors**. Before this PR, `ActorSignal` (`true | { actorKind:'system', sourceWorkflow? }`) short-circuited FGA after tenant scope, so cron/scheduled/autonomous agents inherited tenant-wide capability. Adds:

- Optional `IFGAProvider.requireActor()` hook.
- Extended `ActorSignal` with `agentId`, `permissions`, `scope`.
- `DurableAgent.generate/stream/resume` now enforce agent-level FGA (previously bypassed).
- HTTP agent routes strip `actor` from body and reserve `organizationId` in requestContext (hardening — behavior change).

## Area 1 — Core auth hook (`packages/_internals/auth/**`, `interfaces/fga.ts`, `fga-check.ts`)

### History
- File extracted from core in #17142 (Sep 2025 refactor). No other changes since.
- This PR is the first meaningful evolution.

### Architecture
- `requireFGA(options)` is the single choke point used by agent/tool/workflow authorization code paths.
- Actor path short-circuits at line 113 (`isActorSignal(actor)`).
- After this PR, sequence is: (1) tenant `organizationId` must be present or throw, (2) if provider has `requireActor` call it, (3) otherwise legacy bypass. Telemetry event now labels `actor_authorized_by: 'provider' | 'bypass'`.

### Interface surface
- `ActorSignal` widened with `agentId` / `permissions` / `scope`. Old shape (`true` or `{ actorKind:'system', sourceWorkflow? }`) remains valid. Type-only change (no runtime break).
- `IFGAProvider.requireActor?` is optional. Undefined → legacy behavior. Defined → provider owns decision + must throw `FGADeniedError` to deny.
- `checkActor` was proposed in issue #19247 but was **removed** from PR by commit `refactor(core): remove unused actor check hook` — good, avoided unused surface.

### Tests
- `fga-check.test.ts` covers: (a) no-hook bypass preserved (legacy contract), (b) still fails closed when no tenant scope, (c) delegates to `requireActor` with forwarded `context.requestContext`, (d) denial propagates, (e) `true` shorthand works. Meaningful assertions, not just call-counts.

### Concerns / observations
- Assertion in test at line 193 verifies `context: { requestContext }` is forwarded. Good — protects against regression if `mergeFGAContext` output shape changes.
- `permissions` on `ActorSignal` is explicitly documented as **untrusted self-asserted claim**. Provider is expected to resolve authoritative grants from `agentId`. Documentation reinforces this in the JSDoc and the changeset.
- Core tenant check verifies `organizationId` **exists** but not that `actor.agentId` **belongs** to that org — this is delegated to provider. Both the PR body and issue call it out explicitly. Should be repeated loudly in `docs/src/content/en/docs/server/auth/fga.mdx` (Area to check in Phase 4 walkthrough).

## Area 2 — Durable agent enforcement (`packages/core/src/agent/durable/**`)

### The gap that was there
Base `Agent.stream/generate` enforce `agents:execute` inline. Durable/evented subclasses override the public entry points to run a workflow instead — so the FGA gate was silently skipped. This is the "critical" gap that made the PR necessary for anyone wanting durable/scheduled agents under FGA.

### The fix
- Shared helper `Agent.requireAgentExecutionFGA()` (agent.ts:6500) — `protected` so subclasses can call it. Forwards `actor`, `requestContext`, `memory`, and rich metadata (`agentId`, `agentName`, `runId`, `executionResourceId`).
- `DurableAgent.stream()` @ 1066 — gate before `prepareForDurableExecution`.
- `DurableAgent.generate()` @ 2074 — same.
- `DurableAgent.resume()` @ 1361 — same, with `snapshotMemoryInfo` also forwarded so thread-scoped resource resolution works on rehydrated runs.

### Actor plumbing through the workflow layer
- `executeWorkflow()` @ 937 pulls `actor` off `workflowInput.options?.actor` and passes it to `run.start(...)` — this seeds the workflow's actor context.
- `resume()` @ 1524 passes `resolvedOptions.actor` (per-call) to `run.resume(...)` — **not** the initial actor. Grayson's commit "fix(core): keep durable resume actor per-call" is exactly this.
- Tool-call step `tool-call.ts:720` reads `actor` from the workflow-step params (per-segment), not from `getInitData().options.actor`. Comment above line 720 loudly warns future maintainers.
- `builder.ts:770` — tool builder itself enforces `tools:execute` FGA with a canonical tool resource id: `getAgentToolFGAResourceId(agentId, toolName)` / `getMCPToolFGAResourceId(serverName, toolName)` / `getStandaloneToolFGAResourceId(toolName)`. This is the choke point where `requireActor` gets called for autonomous tool execution.

### Tests
- `durable-agent-actor.test.ts` — small, focused: verifies both `DurableAgent` and `EventedAgent` forward `actor` to `run.start`/`startAsync`. Parametrized over the two subclasses via `it.each` — nice.
- `tool-call-actor.test.ts` — verifies the per-segment actor invariant (initial actor ≠ resumed actor; execute() sees the resumed one). Directly guards the invariant Grayson's fix commit named.
- **My earlier observation about a `ReferenceError` in `approveTool`/`declineTool` at lines 76/89 was stale/wrong.** The actual overrides at 2007/2017 (`approveToolCall`/`declineToolCall`) just delegate to `resumeStream` → `resume()`, and the actor flows through `resolvedOptions.actor` naturally. No bug to fix in this file.

### Concerns / observations
- `requireAgentExecutionFGA` uses dynamic `await import('../auth/ee/fga-check')` — matches existing repo pattern for lazy-loading the EE surface into core. Fine.
- Tool-call step already had `actor` in its params — the change here isn't wiring, it's the deliberate choice **not** to reach into `getInitData()` for the initial actor. Test enforces this. Solid.
- One nit: `DurableAgent.generate()` @ 2074 doesn't forward `snapshotMemoryInfo`. It doesn't have a snapshot yet (this is initial execution), so that's correct — but easy to misread.

## Area 3 — HTTP server hardening (`packages/server/**`)

### Implementation
- `packages/server/src/server/constants.ts` — `RESERVED_CONTEXT_KEYS` Set with `MASTRA_*` keys **plus a raw `'organizationId'` string**. `isReservedRequestContextKey(key)` exported for handler use.
- `agents.ts:159` — `normalizePublicExecutionOptions` destructures `{ actor: _actor, requestContext, ...normalized }` — `actor` gets dropped, body-provided requestContext runs through `mergeBodyRequestContext` which skips reserved keys via `isReservedRequestContextKey`.
- Applied to all three routes (generate/stream/resume/sendToolApproval).

### Tests (`agents.test.ts`)
- Test values named `forged-agent` / `forged-org` — intent is obvious. Sends the body a malicious client would send, asserts `actor` is absent and `organizationId` didn't leak.
- Covers regular execution and the durable-thread-subscription path (`sendToolApproval` route at line 1796+).

### Concerns
- ~~Reserved-keys list is fragile.~~ **Confirmed fragile** — `'organizationId'` is a plain string literal, not derived from a `MASTRA_*` constant. If someone adds another reserved key to core (e.g. a new trusted-scope key), the server won't strip it automatically. Doc comment above the line explains why it's here, but no compile-time guarantee. Would benefit from a `RESERVED_REQUEST_CONTEXT_KEYS` export from `@mastra/core/request-context` that server consumes. Not a blocker; a follow-up.
- Silent strip. Body values are dropped without a log. An integrator whose script did `body.actor = { ... }` will just get "authorization denied" with no signal that the actor was stripped. Small DX papercut. Could be addressed with a one-time warning log per handler instance; not required for merge.

## Area 4 — Docs (`docs/src/content/en/docs/server/auth/fga.mdx`)

Adds a `## System actors` section (~40 lines). Covers:
- What system actors are (`true` shorthand vs object form)
- The `requireActor` hook signature with a code example
- **Trust requirements** subsection listing:
  - Actor is per-call; durable resume does **not** restore it
  - HTTP routes strip `actor`; construct server-side only
  - `organizationId` is reserved; construct tenant scope server-side
  - Tenant-scope check verifies `organizationId` exists but **not** that `actor.agentId` belongs to it — provider responsibility
  - `actor.permissions` is a **claim, not a grant**
  - Once `requireActor` is implemented, its errors stop execution (no fallback)

**Docs quality is excellent.** Every concern I flagged earlier as "should be doc'd loudly" is already in there.

## Area 5 — Other diff files

- **`preparation.ts`** — adds `optionsAreResolved?: boolean` flag so `DurableAgent.stream/resume/generate` (which now resolve options themselves to extract `actor` for the FGA gate) don't double-resolve. Small, correct.
- **`evented-agent.ts`** — one-line change: forward `actor: workflowInput.options?.actor` to `run.startAsync()`. Parallels the `DurableAgent.executeWorkflow` change.
- **`loop/workflows/agentic-execution/tool-call-step.ts`** — **removes** local FGA check that authorized against a bare, non-canonical resource id (`inputData.toolName`). Now delegates to `builder.ts:770` which uses canonical ids. Comment above explains this is deliberate — ensures durable and non-durable paths authorize **identically** against the same resource id. Very good change.
- **`agent-fga.test.ts`** (268 new lines) — comprehensive:
  - Base `generate/stream` FGA (bypass, deny, fail-closed)
  - Trusted actor tenant-scope bypass
  - `DurableAgent.generate/stream` deny before durable execution
  - Resume uses **current-call actor**, not persisted
  - **Cold resume fails closed** — persisted snapshot with system actor cannot resurrect trust after process restart
  - Trusted resume context + tool-call label forwarding

The cold-resume test is the standout — it closes a serious privilege escalation vector where an attacker who could write to storage could otherwise forge a trusted system actor into the resume path.

## Final assessment

**Approve, no blockers.** The three concerns I raised earlier turned out to be either wrong (stale `ReferenceError` observation), unfounded (changesets are actually detailed and call out the behavior change), or addressed elsewhere (docs cover every trust caveat I could think of).

Remaining nice-to-haves for follow-up (not blockers):
1. Derive server's reserved-keys list from a core export instead of a literal string.
2. Consider a one-time warning log when actor/organizationId is stripped from a body, to help integrators notice the behavior change.
3. Consider extending the "cold resume fails closed" test to also cover a snapshot with `actor: true` (anonymous system) to be maximally paranoid.
