# Phase 4 — Runtime fan-out (`packages/core/src/tool-provider/runtime.ts`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 3 — Composio adapter](./phase-3-composio-adapter.md)
> Next phase: [Phase 5 — Generic server routes](./phase-5-server-routes.md)

## Goal

`resolveStoredIntegrationTools` exists in core, fans out per connection, renames tools with a label-derived suffix, and appends a routing hint to each tool's description. Agent hydration in `packages/editor/src/namespaces/agent.ts` calls it once for the whole `integrationTools` blob.

## Background

- **Why this phase is ordered here**: needs a working single-connection `resolveTools` from Phase 3. Owns the LLM-facing shape (suffix + description hint) so the provider stays simple.
- Spec sections to re-read:
  - ARCHITECTURE §8 "Runtime fan-out"
  - ARCHITECTURE §3.5.1 LLM-facing example
- Inherited blockers / constraints: provider only sees a single `connectionId` at a time; the loop is owned by the runtime, not the adapter.

## Scope

### Core
- `packages/core/src/tool-provider/runtime.ts` — new. Exports:
  - `resolveStoredIntegrationTools(integrationTools, ctx)` — per ARCHITECTURE §8.
  - `buildConnectionSuffix(label, allLabels)` — sanitizes label, collision-resolves with `_2`/`_3`.
- `packages/core/src/tool-provider/index.ts` — re-export.

### Editor
- `packages/editor/src/namespaces/agent.ts` — replace prototype branching with:
  ```ts
  if (storedAgent.integrationTools) {
    tools = {
      ...tools,
      ...await resolveStoredIntegrationTools(storedAgent.integrationTools, requestContext),
    };
  }
  ```
  - Delete prototype's `connectionsByToolkit` / `bindings` / `authMode` reads.

### Tests
- `packages/core/src/tool-provider/runtime.test.ts`:
  - Single connection → tool keeps original slug, no suffix.
  - Two connections, distinct labels → both renamed with `__WORK` / `__PERSONAL`, description hint appended.
  - Two connections, colliding sanitized labels → `_2` disambiguation.
  - Provider error from one connection doesn't poison others.
  - `requestContext` plumbed through to each `provider.resolveTools` call.
  - `capabilities.multipleConnectionsPerService === false` → asserts ≤1 connection per service before fan-out.

**Explicitly NOT touched**: provider internals, server routes, UI, storage shape.

## Acceptance truths

- [ ] `resolveStoredIntegrationTools` calls `provider.resolveTools` exactly N times for N connections on a `toolService`.
- [ ] Single-connection tool keeps the original `toolSlug` (no suffix).
- [ ] Two-connection tools produce two entries with `__<LABEL>` suffixes.
- [ ] Each renamed tool has `Routes through connection: <Label>` appended to its description.
- [ ] One provider failure surfaces as a single tool error; sibling connections still resolve.
- [ ] `requestContext` reaches the adapter (asserted via mock).
- [ ] Editor agent hydration uses the new helper (verified by removed prototype code path).

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/editor build
pnpm --filter ./packages/core test runtime
pnpm --filter ./packages/editor test agent
```

All must pass. Manual smoke (recorded in handoff): create agent with two Gmail connections → LLM-facing tool list includes `gmail.fetch_emails__WORK` and `gmail.fetch_emails__PERSONAL`.

## Handoff to next phase

- Canonical fan-out: `packages/core/src/tool-provider/runtime.ts`. Server routes (Phase 5) never call it; only agent hydration does.
- Suffix algorithm finalized in `buildConnectionSuffix`. UI (Phase 6) preview tool names by replaying it client-side.
- `requestContext` contract for adapters now established — Phase 5 server routes propagate `currentUser` into it.
