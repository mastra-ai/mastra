# Phase 5 — Runtime Tool Execution (extend `ComposioToolProvider.resolveTools`)

> Parent RFC: [`../composio-research.md`](../composio-research.md) — see "DISCOVERY (rev 3)".
> Previous phase: [Phase 4 — Builder UI](./phase-4-builder-ui.md)
> Next phase: [Phase 6 — Observability + Admin Polish](./phase-6-ops.md)

> **Rev 3 delta**: runtime resolution already flows through `EditorAgentNamespace.resolveStoredIntegrationTools` → `ComposioToolProvider.resolveTools(slugs, configs, options)`. Phase 5 is now: extend that path so it honors `resolveComposioUserId` and per-agent `connectedAccountId` pinning. Do **not** introduce a separate `loadComposioTools` boot hook — extend the existing resolver.

> **Rev 4 — runtime pinning**:
>
> Phase 3 added `connectionsByToolkit?: Record<string, string>` to both `StorageMCPClientToolsConfig` and `ResolveToolProviderToolsOptions`, and `EditorAgentNamespace.resolveStoredIntegrationTools` now forwards it. Phase 5's whole job is to make `ComposioToolProvider.resolveTools` consume it:
>
> 1. **Replace `composio.tools.get(userId, { tools })`** with a session-based call: `composio.create(userId, { tools, accountSelection, manageConnections: false })` followed by `session.tools()`. `accountSelection` is built from `options.connectionsByToolkit`.
> 2. **`userId`** — `resolveTools` must derive it via `resolveComposioUserId({ registry })`, not from `requestContext[MASTRA_RESOURCE_ID_KEY]`. The current fallback to `'default'` is removed. In v1 this always returns `registry.platformUserId`; vNext branches on `composioAuthMode`.
> 3. **Server-side ownership check on save** (Phase 4 territory but called out here): when an agent saves `connectionsByToolkit`, the server verifies each `connectedAccountId` belongs to the resolved `userId` so we never persist a pin Composio will later reject.
> 4. **Revoked-pin behavior** — if `session.tools()` errors for a revoked account, `resolveTools` returns a typed `ComposioConnectionRevokedError` so the agent fails closed with a clear message. Surfacing this in the UI is Phase 6.

> **Rev 5 — post-Phase-3 ship locks**:
>
> - `resolveComposioUserId` ships at `@mastra/core/agent-builder/ee` (NOT editor). Signature: `resolveComposioUserId(ctx: { registry: ResolvedComposioRegistry }): string`. Throws `ComposioRegistryDisabledError` if registry is disabled.
> - `ComposioConnectionRevokedError` will be added to `@mastra/core/agent-builder/ee` (matches `ComposioAuthConfigMissingError`, `ComposioToolkitNotAllowedError` locations).
> - `ComposioToolProvider` is the only consumer; the editor module does NOT need new files for Phase 5. The provider imports from core.
> - How `resolveTools` gets the `registry`: the editor's resolver pass-through (`EditorAgentNamespace.resolveStoredIntegrationTools`) does NOT pass `registry`. **Decision point at impl:** either (a) inject the registry via the `ComposioToolProvider` constructor / setter (provider knows its own registry once the editor boots), or (b) expand `ResolveToolProviderToolsOptions` with `registry`. Lean (a) — provider holds the registry instance, set during validation in Phase 1.

## Goal

A saved agent's Composio tools execute at runtime with the correct Composio `userId` and pinned `connectedAccountId`. Extend the existing `ComposioToolProvider.resolveTools` (in `packages/editor/src/providers/composio.ts`) so it (a) derives `userId` via `resolveComposioUserId`, and (b) honors `options.connectionsByToolkit` from Phase 3 by passing `accountSelection` into a session created with `composio.create(...)`. No session caching across runs.

## Background

- **Why this phase is ordered here**: the feature only becomes "real" when agents can call tools. Sits after UI so we have real saved bindings to test against. Last phase before observability.
- Parent RFC sections to re-read:
  - "SESSIONS → When to call `composio.create()`"
  - "SESSIONS → Why `manageConnections: false`"
  - "USER IDS — same or different across phases? → v1 — Platform auth"
  - "MULTI-ACCOUNT PER TOOLKIT → Resolver shape (full)"
- Inherited blockers: `resolveComposioUserId()` already exists from Phase 3 — use it, do not re-implement. `integrationTools.composio` slot is populated by Phase 4.

## Scope

### `ComposioToolProvider.resolveTools` (the single chokepoint)
- `packages/editor/src/providers/composio.ts` — replace the current `composio.tools.get(userId, { tools: toolSlugs })` body with:
  - Resolve `userId` via `resolveComposioUserId({ registry })` imported from `@mastra/core/agent-builder/ee`. No silent fallback to `'default'`. `registry` comes from the provider instance (see Rev 5).
  - Build `accountSelection` from `options.connectionsByToolkit` (keys are toolkit slugs, values are `connectedAccountId`s). Toolkits without a pin omit the entry — Composio uses its default-account behavior for those.
  - Call `composio.create(userId, { tools: toolSlugs, accountSelection, manageConnections: false })`, then `session.tools()`.
  - Map `MastraToolCollection` → `Record<string, ToolAction>` exactly as today; description overrides from `toolConfigs` still apply.
  - On revoked / missing account errors from `session.tools()`, throw `ComposioConnectionRevokedError` with the `connectedAccountId` and toolkit attached.
- `ComposioToolProvider` constructor / a new `setRegistry(registry)` method (called from Phase 1's `validateComposioRegistry` flow) so the provider always knows the active `ResolvedComposioRegistry`. The provider keeps its own `apiKey` already; `registry` is the missing piece.

### Core module additions
- `packages/core/src/agent-builder/ee/composio-errors.ts` (or extend `composio-connections.ts`) — `ComposioConnectionRevokedError` typed error class. Exported via `packages/core/src/agent-builder/ee/index.ts`.
- `resolveComposioUserId` already shipped in Phase 3 at `@mastra/core/agent-builder/ee/composio-user-id.ts` — no edits expected unless v1.x adds a second mode.
- No new files in `@mastra/editor`. No `runtime.ts`. No `loadComposioTools`. No agent-boot hook. The existing `EditorAgentNamespace.resolveStoredIntegrationTools` path already calls `resolveTools` — that is the only seam we need.

### Tool-name collisions
- Already handled by the merge in `resolveStoredIntegrationTools` (later keys win deterministically). If we want a hard error instead of silent override, add a single check after the merge in `EditorAgentNamespace` — **not** inside the provider. Decide at impl time; default is "log a warning, last write wins".

### Tests
- `packages/editor/src/providers/composio.test.ts` — **create this file** (does not exist yet). Unit tests with mocked `@composio/core`:
  - `resolveTools` builds `accountSelection` from `options.connectionsByToolkit` and forwards to `composio.create`.
  - `manageConnections: false` is always passed.
  - Two calls produce two independent sessions (no caching across calls).
  - Missing pin for a toolkit omits its `accountSelection` entry but still resolves tools.
  - SDK error for revoked account surfaces as `ComposioConnectionRevokedError`.
- `packages/editor/src/namespaces/agent.test.ts` — extend to assert `connectionsByToolkit` flows from `integrationTools.composio` into `provider.resolveTools` options.
- E2E (against a sandbox Composio account if available, otherwise mocked SDK): two agents pinned to different gmail accounts each call `gmail.send_email`; assert each call carries its agent's pinned `connectedAccountId`.

**Explicitly NOT touched**: connection health surfacing in admin UI, error UX polish (Phase 6 owns these), `user` and `per-author` modes (still throw "not implemented" if anything ever sets `composioAuthMode !== 'platform'`).

## Acceptance truths

- [ ] `ComposioToolProvider.resolveTools` uses `composio.create(...).tools()` (session-based), not `composio.tools.get(...)`.
- [ ] Two calls to `resolveTools` produce two independent sessions — no session caching across calls.
- [ ] Session is created with `manageConnections: false` on every call.
- [ ] `accountSelection` is built from `options.connectionsByToolkit`; toolkits without a pin omit the entry (Composio falls back to its default).
- [ ] Two agents with different `connectedAccountId` for the same toolkit each invoke tools against their pinned account (asserted via SDK mock or sandbox).
- [ ] Agent with zero Composio bindings does not trigger `resolveTools` at all (existing short-circuit in `resolveStoredIntegrationTools`).
- [ ] Tool-name collision between a native Mastra tool and a Composio tool is detected — at minimum a warning is logged; behavior decided in impl PR.
- [ ] `resolveComposioUserId` is the **only** source of `userId` for `resolveTools` across the codebase; the previous `requestContext[MASTRA_RESOURCE_ID_KEY] ?? 'default'` path is removed.
- [ ] `ComposioConnectionRevokedError` is thrown (not a generic `Error`) when `session.tools()` fails due to a revoked / missing pinned account.

## Verification step

```
pnpm --filter @mastra/editor build && pnpm --filter @mastra/editor test -- composio
pnpm --filter @mastra/core build && pnpm --filter @mastra/core test
pnpm --filter @mastra/editor tsc --noEmit
pnpm --filter @mastra/editor test -- agent.test       # resolveStoredIntegrationTools forwards connectionsByToolkit
pnpm --filter @mastra/playground test:e2e -- composio-runtime
```

All must pass. Manual smoke (use `mastra-smoke-test` skill): boot Studio, save two agents pinned to different gmail accounts, send "Email me a hello" from each — emails arrive from the correct accounts.

## Handoff to next phase

- Canonical runtime entry: `ComposioToolProvider.resolveTools` in `packages/editor/src/providers/composio.ts`. Phase 6 observes metrics/errors at this boundary.
- Session-per-call is the locked-in pattern. If Phase 6 finds latency unacceptable, the discussion is "should we cache sessions inside the provider" — not "where to add caching" (single chokepoint).
- `ComposioConnectionRevokedError` is the contract for Phase 6 to surface in `GET /editor/builder/infrastructure` and in the agent runtime error UX.
- Follow-up backlog: per-agent tool latency metrics; vNext per-agent `composioAuthMode` switch (Phase 5 leaves `resolveComposioUserId` as the only edit point); session reuse opportunities (deferred).
