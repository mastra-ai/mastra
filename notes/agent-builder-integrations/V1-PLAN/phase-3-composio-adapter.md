# Phase 3 — Composio adapter (`packages/editor/src/providers/composio.ts`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 2 — BaseIntegrationProvider + registry](./phase-2-base-provider-registry.md)
> Next phase: [Phase 4 — Runtime fan-out](./phase-4-runtime-fanout.md)

## Goal

`ComposioToolProvider extends BaseIntegrationProvider` with single-connection `resolveTools`, full auth surface, and provider-internal Composio types. `connectedAccountId` only appears inside this file. Author-mode-only (single connection per `(authorId, toolService)` resolved per binding).

## Background

- **Why this phase is ordered here**: first real adapter validates the `BaseIntegrationProvider` contract. Runtime fan-out (Phase 4) depends on a single-connection `resolveTools`, not a multi-binding loop.
- Spec sections to re-read:
  - ARCHITECTURE §3 "Core types" (esp. `resolveTools` signature)
  - ARCHITECTURE §13 "Adapter design principles"
  - ARCHITECTURE §14 "Auth dependency (OSS / no-RBAC mode)" — `'default'` fallback
- Inherited blockers / constraints: must preserve the prototype's `outputSchema = undefined` mutation (Composio runtime issue). No agent-level `authMode`, no `bindings[]` array argument.

## Scope

### Editor
- `packages/editor/src/providers/composio.ts` — full rewrite (don't patch the prototype):
  - `readonly id = 'composio' as const`.
  - Constructor: `{ apiKey, allowedToolServices?, allowedTools? }`.
  - `capabilities = { multipleConnectionsPerService: true, batchConnectionStatus: true, reauthorizeReusesConnectionId: true }`.
  - `fetchToolServices()` / `fetchTools()` — wrap Composio SDK list calls.
  - `resolveTools({ toolSlugs, connectionId, requestContext })` — single connection. Calls `composio.tools.get(internalUserId, { tools: toolSlugs })` with `beforeExecute` injecting `connectedAccountId = connectionId`. Mutates each tool: `tool.outputSchema = undefined`.
  - `internalUserId` resolution: `storedAgent.authorId ?? requestContext.currentUser?.id ?? 'default'` (per ARCHITECTURE §14). Never `'default'` for v1.5 invoker mode.
  - `authorize({ toolService, connectionId? })` — `initiateConnection`; returns `{ url, authId }`.
  - `getAuthStatus(authId)` — polls Composio.
  - `getConnectionStatus({ items })` — one `listConnections` call, filtered locally.
  - `getHealth()` — auth-config presence per tool service.
- `packages/editor/src/composio.ts` — re-export only `ComposioToolProvider`. Drop `ArcadeToolProvider` re-export (deferred to v1.5).
- `packages/editor/src/arcade.ts` — delete entry.

### Tests
- `packages/editor/src/providers/composio.test.ts` — rewrite:
  - `listToolServices` honors `allowedToolServices`.
  - `listTools` honors `allowedTools` glob (`Gmail.*`).
  - `resolveTools` single-connection: tool list correct, `beforeExecute` injects `connectedAccountId`, `outputSchema` is `undefined` after resolve.
  - `authorize` returns `{ url, authId }` shape.
  - `getConnectionStatus` batch — one SDK call for N items.
  - `'default'` fallback when no `authorId` and no `currentUser`.

**Explicitly NOT touched**: no fan-out loop inside the provider, no `bindings[]` argument, no agent-level `authMode`, no UI, no server routes.

## Acceptance truths

- [ ] `ComposioToolProvider` extends `BaseIntegrationProvider`.
- [ ] `provider.id === 'composio'` typed as the literal `'composio'`.
- [ ] `resolveTools` accepts a single `connectionId` and returns tools whose `outputSchema === undefined`.
- [ ] `beforeExecute` on every resolved tool injects `connectedAccountId` matching the passed `connectionId`.
- [ ] `getConnectionStatus({ items: [a, b, c] })` makes exactly one underlying SDK call.
- [ ] `internalUserId` resolves to `'default'` only when both `storedAgent.authorId` and `requestContext.currentUser?.id` are missing.
- [ ] The string `'connectedAccountId'` appears nowhere outside this file (verified via repo search).

## Verification step

```
pnpm --filter ./packages/editor build
pnpm --filter ./packages/editor test composio
```

All must pass. 100% of Composio adapter tests green.

## Handoff to next phase

- Single-connection `resolveTools` is the contract Phase 4's `resolveStoredIntegrationTools` calls in a loop.
- `provider.capabilities` is finalized — Phase 6's UI reads `multipleConnectionsPerService` to gate the multi-select picker.
- `'default'` is the OSS `userId` fallback; document this in changeset (Phase 11).
- All Composio runtime quirks (`outputSchema = undefined`) live in this file only.
