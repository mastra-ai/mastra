# Phase 3 — Composio adapter (`packages/editor/src/providers/composio.ts`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 2 — BaseToolIntegration + registry](./phase-2-base-provider-registry.md)
> Next phase: [Phase 4 — Runtime fan-out](./phase-4-runtime-fanout.md)

## Goal

`ComposioToolIntegration extends BaseToolIntegration` with single-connection `resolveTools`, full auth surface, and provider-internal Composio types. `connectedAccountId` only appears inside this file. Author-mode-only (single connection per `(authorId, toolService)` resolved per binding).

## Background

- **Why this phase is ordered here**: first real adapter validates the `BaseToolIntegration` contract. Runtime fan-out (Phase 4) depends on a single-connection `resolveTools`, not a multi-binding loop.
- Spec sections to re-read:
  - ARCHITECTURE §3 "Core types" (esp. `resolveTools` signature)
  - ARCHITECTURE §13 "Adapter design principles"
  - ARCHITECTURE §14 "Auth dependency (OSS / no-RBAC mode)" — `'default'` fallback
- **Branch reality**: the current `providers/composio.ts` is the editor-only catalog adapter (180 lines). It has no auth surface, no `connectedAccountId` injection, and no `outputSchema = undefined` mutation. Phase 3 is a **fresh implementation** of the auth + runtime surface, not a port of the on-disk file. Patterns to lift come from `.context/composio-research/HOW-IT-WORKS.md` (stashed prototype reference), but every line is new code against the new `ToolIntegration` interface.
- Inherited constraints: no agent-level `authMode`, no `bindings[]` array argument, no fan-out inside the provider.

## Scope

### Editor
- `packages/editor/src/providers/composio.ts` — replace the existing legacy adapter (do not patch it; the old `ToolProvider` shape is incompatible):
  - `readonly id = 'composio' as const`.
  - `readonly displayName = 'Composio'`.
  - Constructor: `{ apiKey, allowedToolServices?, allowedTools? }`. Pass the allowlists through to `super({ allowedToolServices, allowedTools })`.
  - `capabilities = { multipleConnectionsPerService: true, batchConnectionStatus: true, reauthorizeReusesConnectionId: true }`.
  - `fetchToolServices()` / `fetchTools(toolService)` — wrap Composio SDK list calls (`composio.toolkits.get`, `composio.tools.getRawComposioTools`). `BaseToolIntegration` applies the allowlist filter on top — adapter never reads `allowedTools` directly.
  - `resolveTools({ toolSlugs, toolMeta, connectionId, requestContext })` — single connection. Calls `composio.tools.get(internalUserId, { tools: toolSlugs })` via the `MastraProvider` client so returned tools are already in `createTool()` shape. **New behavior** (not on current branch): wrap each tool with `beforeExecute` that injects `connectedAccountId = connectionId`, and set `tool.outputSchema = undefined` to dodge the Composio runtime's union-schema rejection. Apply per-tool `toolMeta[slug].description` overrides.
  - `internalUserId` resolution: read `requestContext[MASTRA_RESOURCE_ID_KEY]` (string) → else `'default'`. For v1 (author-only) the runtime fan-out caller is responsible for putting the agent's `authorId` (or `'default'`) into `requestContext` under that key; the adapter does not see `storedAgent.authorId` directly.
  - `authorize({ toolService, connectionId? })` — `composio.connectedAccounts.initiateConnection(...)`; returns `{ url, authId }`.
  - `getAuthStatus(authId)` — polls `composio.connectedAccounts.get(authId)` and maps to `'pending' | 'completed' | 'failed'`.
  - `getConnectionStatus({ items })` — one `composio.connectedAccounts.list({ ids: [...] })` call; bucket result by `connectionId`.
  - `getHealth()` — best-effort SDK reachability probe (e.g. `toolkits.get({ limit: 1 })`); return `{ ok, message?, details? }`.
- `packages/editor/src/composio.ts` — re-export only `ComposioToolIntegration` + its config type. Drop the `ComposioToolProvider` re-export.
- `packages/editor/src/arcade.ts` — delete entry (Arcade is v1.5).
- `packages/editor/src/providers/arcade.ts` — delete (Arcade is v1.5).
- `packages/editor/src/providers/index.ts` — drop Arcade re-export if present.

### Tests
- `packages/editor/src/providers/composio.test.ts` — new file (no existing test on this branch):
  - `listToolServices` honors `allowedToolServices`.
  - `listTools` honors `allowedTools` glob (`gmail.*`).
  - `resolveTools` single-connection: tool list correct, `beforeExecute` injects `connectedAccountId`, `outputSchema` is `undefined` after resolve, per-tool description overrides applied.
  - `authorize` returns `{ url, authId }` shape.
  - `getConnectionStatus` batch — one SDK call for N items.
  - `internalUserId`: reads `requestContext[MASTRA_RESOURCE_ID_KEY]` when present; falls back to `'default'` when absent.
- `packages/editor/src/editor-integration-tools.test.ts` — delete or skip the `ArcadeToolProvider e2e` block and migrate the `ComposioToolProvider e2e` block to the new class name + interface. The pre-existing skip-guard (`describe.skipIf(!process.env.COMPOSIO_API_KEY)`) stays.

**Explicitly NOT touched**: no fan-out loop inside the provider, no `bindings[]` argument, no agent-level `authMode`, no UI, no server routes, no `storedAgent.authorId` plumbing (that lands in Phase 4's runtime fan-out).

## Acceptance truths

- [ ] `ComposioToolIntegration` extends `BaseToolIntegration`.
- [ ] `integration.id === 'composio'` typed as the literal `'composio'`.
- [ ] `resolveTools` accepts a single `connectionId` and returns tools whose `outputSchema === undefined`.
- [ ] `beforeExecute` on every resolved tool injects `connectedAccountId` matching the passed `connectionId`.
- [ ] `getConnectionStatus({ items: [a, b, c] })` makes exactly one underlying SDK call.
- [ ] `internalUserId` reads `requestContext[MASTRA_RESOURCE_ID_KEY]` and falls back to `'default'` only when that key is missing.
- [ ] The string `'connectedAccountId'` appears nowhere outside `providers/composio.ts` (verified via repo search).
- [ ] `packages/editor/src/providers/arcade.ts` and `packages/editor/src/arcade.ts` are deleted; `editor-integration-tools.test.ts` has no live Arcade references.
- [ ] The legacy `ComposioToolProvider` class name is gone from `packages/editor/src/`.

## Verification step

```
pnpm --filter ./packages/editor build
pnpm --filter ./packages/editor test composio
pnpm --filter ./packages/core build:lib    # consumers re-exported types
```

Also run a workspace-level typecheck since `examples/agent-builder/src/mastra/index.ts` currently constructs `ComposioToolProvider`; Phase 3 must migrate that callsite (or the example build will fail). The example app is the canonical smoke target — its `index.ts` should now register the integration via the new array form:

```ts
toolIntegrations: [
  new ComposioToolIntegration({ apiKey: process.env.COMPOSIO_API_KEY ?? '' }),
] as const,
```

All builds and adapter tests must pass.

## Handoff to next phase

- Single-connection `resolveTools` is the contract Phase 4's `resolveStoredToolIntegrations` calls in a loop.
- `provider.capabilities` is finalized — Phase 6's UI reads `multipleConnectionsPerService` to gate the multi-select picker.
- `'default'` is the OSS `userId` fallback; document this in changeset (Phase 11).
- All Composio runtime quirks (`outputSchema = undefined`) live in this file only.
