# Phase 9 — Health pill (`packages/playground/src/domains/tool-providers/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 8 — `agentBuilderTool` schema](./phase-8-agent-builder-tool.md)
> Next phase: [Phase 10 — Cleanup](./phase-10-cleanup.md)

## Goal

The Tools panel header shows a per-agent health pill backed by batched `getConnectionStatus`. Aggregates across providers, breaks down per tool service in a popover. No Composio-named components survive.

## Background

- **Why this phase is ordered here**: depends on Phase 5 batch route + Phase 6 hooks. Independent of Phases 7-8.
- Spec sections to re-read:
  - ARCHITECTURE §9.3 "Health pill"
  - ARCHITECTURE §7 batch endpoint contract
- Inherited blockers / constraints: must use the per-provider batch endpoint (one HTTP call per provider, not one per connection).

## Scope

### Playground
- `packages/playground/src/domains/tool-providers/hooks/use-agent-health.ts` — derive `items` from agent connections, call `connection-status` once per provider, aggregate to `{ ok, warn, error }`.
- `packages/playground/src/domains/tool-providers/components/health-pill.tsx` — chip + popover. Rollup states `✓` / `⚠` / `✕`. Popover lists per tool service rows with reauthorize link.
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx` — mount the pill in the section header.

### Drops
- `packages/playground/src/domains/composio/components/composio-health-pill.tsx`.
- `useComposioHealth` hook.

### Tests
- `packages/playground/src/domains/tool-providers/components/health-pill.test.tsx` — rollup states, per-tool-service popover rows, reauthorize click triggers `useAuthorize`.

**Explicitly NOT touched**: server routes (already exist from Phase 5), form schema, `agentBuilderTool` schema.

## Acceptance truths

- [ ] `use-agent-health` makes exactly one HTTP call per provider regardless of connection count.
- [ ] Pill renders `✓` when all connections are healthy.
- [ ] Pill renders `⚠` when at least one connection is revoked or stale.
- [ ] Popover identifies the disconnected `(toolService, label)` pair by name.
- [ ] Clicking "Reauthorize" in the popover invokes the same `useAuthorize` flow as the picker; pill flips back to `✓` after success.
- [ ] Repo-wide search for `useComposioHealth` and `composio-health-pill` returns zero hits.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test health-pill
```

All must pass. Manual smoke: disconnect a Gmail connection in the Composio dashboard → pill flips to `⚠` within the React Query refetch window, popover names the disconnected label, "Reauthorize" link works.

## Handoff to next phase

- Cleanup (Phase 10) confirms `useComposioHealth` is gone and removes any remaining Composio-named references.
- Health pill is the v1 user-facing surface for connection problems — v1.5 invoker mode adds the inline mid-chat Connect badge as a second surface.
