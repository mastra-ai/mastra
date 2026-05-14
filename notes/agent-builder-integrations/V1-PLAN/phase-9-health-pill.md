# Phase 9 — Health pill (`packages/playground/src/domains/tool-integrations/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 8 — `agentBuilderTool` surface](./phase-8-agent-builder-tool.md)
> Next phase: [Phase 10 — Cleanup](./phase-10-cleanup.md)

## Goal

The Tools panel header shows a per-agent health pill backed by batched `getConnectionStatus`. Aggregates across the integrations bound to the agent, breaks down per `toolService` in a popover, and lets the user trigger the same reauthorize flow already wired in the `ConnectionPicker`.

## Background

- **Why this phase is ordered here**: depends on Phase 5's batch route, Phase 6's `useConnectionStatus` + `useAuthorize` hooks, and Phase 7's `toolIntegrations` form slice.
- Spec sections to re-read:
  - ARCHITECTURE §9.3 "Health pill"
  - ARCHITECTURE §7 batch endpoint contract (`getConnectionStatus`)
  - ARCHITECTURE §9.2 reauth semantics (calls `authorize` with the existing `connectionId`)
- Inherited blockers / constraints: one HTTP call per provider per render — never one-per-connection. Hook keys must be stable across rerenders to avoid refetch storms.

## Current branch reality (read before changing)

- New UI domain lives at `packages/playground/src/domains/tool-integrations/`. The legacy `tool-providers/` directory is **left in place** — do not delete in this phase (handled in Phase 10).
- Phase 6 already shipped:
  - `hooks/use-connection-status.ts` — batched query keyed by sorted `(toolService, connectionId)` pairs, returns `Record<connectionId, { connected }>`.
  - `hooks/use-authorize.ts` — full popup + poll flow, accepts `connectionId` for reauth.
  - `components/connection-picker.tsx` — already has working `handleReauthorize` and renders a disconnected state.
- Phase 7 stores connections under `form.toolIntegrations[providerId].connections[toolService] = Connection[]`.
- No `packages/playground/src/domains/composio/` exists on this branch. There is nothing to delete.

## Scope

### Playground
- `packages/playground/src/domains/tool-integrations/hooks/use-agent-health.ts`
  - Input: the agent's `toolIntegrations` form slice.
  - For each `providerId` with at least one connection, derives `items: { toolService, connectionId }[]` and calls `useConnectionStatus`.
  - Aggregates into a per-provider rollup `{ state: 'ok' | 'warn' | 'error', byToolService: Record<toolService, { connected: number; total: number; disconnected: Connection[] }> }`.
  - Top-level rollup across providers: `ok` if every connection is connected; `warn` if at least one but not all are disconnected; `error` if everything in a provider is disconnected.
- `packages/playground/src/domains/tool-integrations/components/health-pill.tsx`
  - Visual chip + popover. Renders `✓` / `⚠` / `✕` and a label like `Integrations ✓`.
  - Popover lists rows per `(providerId, toolService)` with `n of m connected` and a "Reauthorize" button per disconnected `(connection)`.
  - "Reauthorize" calls `useAuthorize` with `{ integrationId, toolService, connectionId }` (reuses the existing bucket — same path as the picker).
  - On `useAuthorize` success, invalidates the matching `useConnectionStatus` query so the pill flips back without a full reload.
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx`
  - Mount `HealthPill` in the section header next to the existing title. Read `toolIntegrations` from form state via `useWatch`.

### Tests
- `packages/playground/src/domains/tool-integrations/hooks/use-agent-health.test.ts`
  - Provider with 2 healthy connections → `state: 'ok'`.
  - Provider with 1 healthy + 1 disconnected → `state: 'warn'`, `disconnected` carries the offending `Connection`.
  - Provider with 0 healthy → `state: 'error'`.
  - Empty `toolIntegrations` → returns empty rollup, does not call `useConnectionStatus`.
  - Stable query key: two renders with the same connections do not refetch.
- `packages/playground/src/domains/tool-integrations/components/health-pill.test.tsx`
  - Pill renders correct symbol per aggregate state.
  - Popover lists per-toolService rows.
  - Disconnected row shows "Reauthorize"; clicking it calls `useAuthorize` mock with the right `connectionId`.
  - Reauth success invalidates the connection-status query (assert via mock).

**Explicitly NOT touched**: server routes, form schema, mappers, `agentBuilderTool`, legacy `tool-providers/` UI.

## Acceptance truths

- [ ] `use-agent-health` issues exactly one `getConnectionStatus` call per provider regardless of connection count.
- [ ] Pill renders `✓` when every `(connectionId, toolService)` is connected.
- [ ] Pill renders `⚠` when at least one connection is disconnected and at least one is connected (per provider, then aggregated).
- [ ] Pill renders `✕` when every connection on at least one provider is disconnected.
- [ ] Popover identifies the disconnected `(toolService, label)` pair by name.
- [ ] Clicking "Reauthorize" calls `useAuthorize` with the existing `connectionId` (reauth path, never mints a new bucket).
- [ ] Reauth success invalidates the matching `useConnectionStatus` query; pill flips back to `✓` without a manual refresh.
- [ ] No new code under `packages/playground/src/domains/composio/` or `packages/playground/src/domains/tool-providers/`.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test health-pill use-agent-health
```

Manual smoke (requires Phase 3 adapter wired in an example app — not part of v1 plan, do ad-hoc):
- Add Gmail tool + connect an account → pill renders `✓`.
- Disconnect that Gmail account in the Composio dashboard → pill flips to `⚠` within the React Query refetch window.
- Click "Reauthorize" in the popover → OAuth popup completes → pill returns to `✓` without reload.

## Handoff to next phase

- Phase 10 (Cleanup) is the final pass: deletes the legacy `tool-providers/` UI directory once nothing imports from it; this phase intentionally leaves it alone.
- Health pill is v1's only user-facing surface for connection problems. v1.5 invoker mode will add an inline mid-chat Connect badge as a second surface.
