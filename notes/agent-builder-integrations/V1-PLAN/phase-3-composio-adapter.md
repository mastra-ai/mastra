# Phase 3 — Composio adapter (`packages/editor/src/providers/composio-integration.ts`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 2 — BaseToolIntegration + registry](./phase-2-base-provider-registry.md)
> Next phase: [Phase 4 — Runtime fan-out](./phase-4-runtime-fanout.md)

## Goal

`ComposioToolIntegration extends BaseToolIntegration` with single-connection `resolveTools`, full auth surface, and provider-internal Composio types. `connectedAccountId` only appears inside this file. Author-mode-only (single connection per `(authorId, toolService)` resolved per binding).

**Additive only.** The shipped `ComposioToolProvider` (180-line legacy adapter on this branch) is untouched and continues to ride the Phase 2 Option B+ compat shim. The shipped `ArcadeToolProvider` is also untouched (Arcade rewrite waits for v1.5). No deletes in this phase.

**Long-term arc.** The legacy `ComposioToolProvider` class is **not** scheduled for deletion at v1 ship. Phase 10 refactors it into a thin (~< 100 line) wrapper around `ComposioToolIntegration` and marks it `@deprecated` with a target removal version. The actual class deletion is deferred to Phase 10b — the next coordinated `@mastra/editor` major bump (typically once per year). See ARCHITECTURE §14a for the full compat-window table. This Phase 3 only adds `ComposioToolIntegration` alongside the existing class; the eventual collapse is Phase 10's problem.

## Background

- **Why this phase is ordered here**: first real adapter validates the `BaseToolIntegration` contract. Runtime fan-out (Phase 4) depends on a single-connection `resolveTools`, not a multi-binding loop.
- Spec sections to re-read:
  - ARCHITECTURE §3 "Core types" (esp. `resolveTools` signature)
  - ARCHITECTURE §13 "Adapter design principles"
  - ARCHITECTURE §14 "Auth dependency (OSS / no-RBAC mode)" — `'default'` fallback
- **Branch reality**: the on-disk `providers/composio.ts` is the editor-only catalog adapter (180 lines, legacy `ToolProvider` interface). It has no auth surface, no `connectedAccountId` injection, and no `outputSchema = undefined` mutation. The new adapter lives in a new file (`providers/composio-integration.ts`) and implements the `ToolIntegration` contract. Both classes are re-exported side by side. Patterns lifted from the legacy file: client construction, runtime quirks documented in `.context/composio-research/HOW-IT-WORKS.md` (stashed prototype reference).
- Inherited constraints: no agent-level `authMode`, no `bindings[]` array argument, no fan-out inside the provider.

## Scope

### Editor

- `packages/editor/src/providers/composio-integration.ts` — **new file**. Implements `ComposioToolIntegration extends BaseToolIntegration`:
  - `readonly id = 'composio' as const`.
  - `readonly displayName = 'Composio'`.
  - Constructor: `{ apiKey, allowedToolServices?, allowedTools? }`. Passes the allowlists through to `super({ allowedToolServices, allowedTools })`.
  - `capabilities = { multipleConnectionsPerService: true, batchConnectionStatus: true, reauthorizeReusesConnectionId: true }`.
  - `fetchToolServices()` / `fetchTools(toolService)` — wrap Composio SDK list calls (`composio.toolkits.get`, `composio.tools.getRawComposioTools`). `BaseToolIntegration` applies the allowlist filter on top — adapter never reads `allowedTools` directly.
  - `resolveTools({ toolSlugs, toolMeta, connectionId, requestContext })` — single connection. Calls `composio.tools.get(internalUserId, { tools: toolSlugs }, modifiers)` via the `MastraProvider` client so returned tools are already in `createTool()` shape. Wraps each tool with a `beforeExecute` modifier that injects `connectedAccountId = connectionId`. Clears `tool.outputSchema = undefined` (Composio returns union schemas Mastra rejects). Applies per-tool `toolMeta[slug].description` overrides. Both mutations are wrapped in `try/catch` because the property may be non-writable on some SDK versions.
  - `internalUserId` resolution: read `requestContext[MASTRA_RESOURCE_ID_KEY]` (string) → else `'default'`. The runtime fan-out caller (Phase 4) puts the agent's `authorId` (or `'default'`) into `requestContext` under that key; the adapter does not see `storedAgent.authorId` directly.
  - `authorize({ toolService, connectionId? })` — resolves the single ENABLED auth config for `toolService` (throws on zero or multiple); `composio.connectedAccounts.initiate(internalUserId, authConfigId)`; returns `{ url, authId }`.
  - `getAuthStatus(authId)` — `composio.connectedAccounts.get(authId)`; maps Composio status → `'pending' | 'completed' | 'failed'`.
  - `getConnectionStatus({ items })` — one `composio.connectedAccounts.list({ toolkitSlugs: [...uniqueServices] })` call; bucket result locally by `connectionId`. (The Composio SDK doesn't accept `ids` directly — toolkit-filter + local bucket keeps it to one underlying call.)
  - `getHealth()` — best-effort SDK reachability probe (`toolkits.get({ limit: 1 })`); return `{ ok, message?, details? }`.
- `packages/editor/src/composio.ts` — extends the existing re-export to also export `ComposioToolIntegration` + its config type. Legacy `ComposioToolProvider` re-export stays.
- `packages/editor/src/providers/index.ts` — adds re-exports for the new class. Existing `ComposioToolProvider` and `ArcadeToolProvider` re-exports stay.

### Tests

- `packages/editor/src/providers/composio-integration.test.ts` — new file:
  - `listToolServices` honors `allowedToolServices`.
  - `listTools` honors `allowedTools` glob (`gmail.*`).
  - `resolveTools` single-connection: tool list correct, `beforeExecute` injects `connectedAccountId`, `outputSchema` is `undefined` after resolve, per-tool description overrides applied.
  - `authorize` returns `{ url, authId }` shape; throws if zero or multiple ENABLED auth configs match.
  - `getConnectionStatus` batch — one SDK `list` call for N items.
  - `internalUserId`: reads `requestContext[MASTRA_RESOURCE_ID_KEY]` when present; falls back to `'default'` when absent.
- `packages/editor/src/editor-integration-tools.test.ts` — **untouched**. Existing Composio + Arcade e2e blocks continue to exercise the legacy `ToolProvider` shape via the Phase 2 compat shim.

**Explicitly NOT touched**: legacy `ComposioToolProvider`, legacy `ArcadeToolProvider`, the existing `editor-integration-tools.test.ts`, fan-out logic, `bindings[]` argument, agent-level `authMode`, UI, server routes, `storedAgent.authorId` plumbing (Phase 4).

## Acceptance truths

- [ ] `ComposioToolIntegration` extends `BaseToolIntegration`.
- [ ] `integration.id === 'composio'` typed as the literal `'composio'`.
- [ ] `resolveTools` accepts a single `connectionId` and returns tools whose `outputSchema === undefined`.
- [ ] `beforeExecute` on every resolved tool injects `connectedAccountId` matching the passed `connectionId`.
- [ ] `getConnectionStatus({ items: [a, b, c] })` makes exactly one underlying SDK call.
- [ ] `internalUserId` reads `requestContext[MASTRA_RESOURCE_ID_KEY]` and falls back to `'default'` only when that key is missing.
- [ ] The string `'connectedAccountId'` appears nowhere outside `providers/composio-integration.ts` (verified via repo search).
- [ ] Both `ComposioToolProvider` (legacy) and `ComposioToolIntegration` (new) are exported from `@mastra/editor/composio`.
- [ ] Legacy `editor-integration-tools.test.ts` continues to pass (rides Phase 2 compat shim).

## Verification step

```
pnpm --filter ./packages/editor build
pnpm --filter ./packages/editor test composio
pnpm --filter ./packages/core build:lib    # consumers re-exported types
```

The example app (`examples/agent-builder/src/mastra/index.ts`) still registers the legacy `ComposioToolProvider` and must continue to build untouched. Migrating that callsite to the new array form happens in a later phase, not here.

All builds and adapter tests must pass.

## Handoff to next phase

- Single-connection `resolveTools` is the contract Phase 4's `resolveStoredToolIntegrations` calls in a loop.
- `provider.capabilities` is finalized — Phase 6's UI reads `multipleConnectionsPerService` to gate the multi-select picker.
- `'default'` is the OSS `userId` fallback; document this in changeset (Phase 11).
- All Composio runtime quirks (`outputSchema = undefined`, `beforeExecute` injection) live in this file only.
