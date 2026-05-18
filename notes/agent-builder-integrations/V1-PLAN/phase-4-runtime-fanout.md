# Phase 4 — Runtime fan-out (`packages/core/src/tool-integration/runtime.ts`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 3 — Composio adapter](./phase-3-composio-adapter.md)
> Next phase: [Phase 5 — Generic server routes](./phase-5-server-routes.md)

## Goal

`resolveStoredToolIntegrations` exists in core, fans out per connection, renames tools with a label-derived suffix, and appends a routing hint to each tool's description. Agent hydration in `packages/editor/src/namespaces/agent.ts` calls it once for the whole new `toolIntegrations` blob. The legacy `integrationTools` hydration path (already on the branch as `resolveStoredIntegrationTools`) is left alone — both paths coexist until Phase 10.

## Background

- **Why this phase is ordered here**: needs a working single-connection `resolveTools` from Phase 3. Owns the LLM-facing shape (suffix + description hint) so the provider stays simple.
- Spec sections to re-read:
  - ARCHITECTURE §8 "Runtime fan-out"
  - ARCHITECTURE §3.5.1 LLM-facing example
  - ARCHITECTURE §14a "Backwards-compatibility window" — both storage shapes coexist through Phase 10
- **Branch reality**:
  - `packages/editor/src/namespaces/agent.ts` already has `resolveStoredIntegrationTools` (singular method name) reading `storedAgent.integrationTools` and calling `provider.listTools()` / `provider.resolveTools(slugs, configs, opts)` on the **legacy** `ToolProvider` shape. This is the prototype path. It now happens to compile against the new `listTools` return shape (Phase 3 work) but otherwise stays untouched.
  - `packages/core/src/storage/types.ts` already has both `integrationTools` (legacy `Record<string, StorageMCPClientToolsConfig>`) and `toolIntegrations` (new `Record<string, ToolIntegrationConfig>`) fields (Phase 1 added the new one).
  - There is no `packages/core/src/tool-provider/runtime.ts` and there must not be — that module is the deprecated one. The new helper lives in `tool-integration/`.
- Inherited blockers / constraints:
  - Adapter only sees a single `connectionId` at a time; the loop is owned by the runtime, not the adapter.
  - **Compat window**: leave the legacy `resolveStoredIntegrationTools` method and its callsites in `agent.ts` (currently four callers) alone. The new helper is a sibling, not a replacement, until Phase 10.

## Scope

### Core
- `packages/core/src/tool-integration/runtime.ts` — new. Exports:
  - `resolveStoredToolIntegrations(toolIntegrations, ctx, registry)` — per ARCHITECTURE §8. `registry` is the typed `MastraEditor` accessor surface (uses `getToolIntegrationOrThrow` internally to map provider id → `ToolIntegration` instance).
  - `buildConnectionSuffix(label, allLabels)` — sanitizes label (uppercase, non-alnum → `_`), collision-resolves with `_2`/`_3`.
- `packages/core/src/tool-integration/index.ts` — re-export.

The helper takes a `registry` lookup (function or interface), **not** a `MastraEditor` instance directly, so the helper stays in core without pulling editor imports. Editor passes `(id) => this.editor.getToolIntegrationOrThrow(id)` at the callsite.

### Editor
- `packages/editor/src/namespaces/agent.ts` — **add** a new private method `resolveStoredToolIntegrations` (plural — matches the new field name) and call it from the same four sites that already call the legacy `resolveStoredIntegrationTools`. Both methods run; their results are merged into the same `tools` map.
  ```ts
  // New branch — Phase 4
  const integrationToolsLegacy = await this.resolveStoredIntegrationTools(
    storedAgent.integrationTools,  // legacy storage field
    requestContext,
  );
  const integrationToolsNew = await this.resolveStoredToolIntegrations(
    storedAgent.toolIntegrations,  // new storage field (Phase 1)
    requestContext,
  );
  tools = { ...tools, ...integrationToolsLegacy, ...integrationToolsNew };
  ```
- The new private method is a thin wrapper that delegates to the core helper, supplying the registry lookup.

### Tests
- `packages/core/src/tool-integration/runtime.test.ts`:
  - Single connection → tool keeps original slug, no suffix.
  - Two connections, distinct labels → both renamed with `__WORK` / `__PERSONAL`, description hint appended.
  - Two connections, colliding sanitized labels → `_2` disambiguation.
  - Adapter error from one connection doesn't poison others.
  - `requestContext` plumbed through to each `integration.resolveTools` call.
  - `capabilities.multipleConnectionsPerService === false` → asserts ≤1 connection per service before fan-out (throws if multiple).
  - Unknown provider id → `UnknownIntegrationError` from the registry lookup (already tested in Phase 2 but smoke-asserted here too).
- `packages/editor/src/namespaces/agent.test.ts` (or the existing equivalent): hydration covers both branches running side-by-side without collision (same `tools` map, no duplicate keys when both stored fields are populated with different providers).

**Explicitly NOT touched**: provider internals, server routes, UI, storage shape, the legacy `resolveStoredIntegrationTools` method and its callsites.

## Acceptance truths

- [ ] `packages/core/src/tool-integration/runtime.ts` exists and exports `resolveStoredToolIntegrations` + `buildConnectionSuffix`.
- [ ] `resolveStoredToolIntegrations` calls `integration.resolveTools` exactly N times for N connections on a `toolService`.
- [ ] Single-connection tool keeps the original `toolSlug` (no suffix).
- [ ] Two-connection tools produce two entries with `__<LABEL>` suffixes.
- [ ] Each renamed tool has the routing hint appended to its description (text per ARCHITECTURE §3.5.1).
- [ ] One adapter failure surfaces as a single tool error; sibling connections still resolve.
- [ ] `requestContext` reaches the adapter (asserted via mock).
- [ ] Editor agent hydration runs both `resolveStoredIntegrationTools` (legacy) and `resolveStoredToolIntegrations` (new) and merges results; an agent with only the new `toolIntegrations` field still hydrates correctly.
- [ ] Legacy hydration path is **not** modified (callsites unchanged, method body unchanged, signature unchanged).

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/editor build
pnpm --filter ./packages/core test runtime
pnpm --filter ./packages/editor test agent
```

All must pass. Manual smoke (recorded in handoff): create agent with two Gmail connections (stored under `toolIntegrations`) → LLM-facing tool list includes `GMAIL_FETCH_EMAILS__WORK` and `GMAIL_FETCH_EMAILS__PERSONAL`.

## Handoff to next phase

- Canonical fan-out: `packages/core/src/tool-integration/runtime.ts`. Server routes (Phase 5) never call it; only agent hydration does.
- Suffix algorithm finalized in `buildConnectionSuffix`. UI (Phase 6) previews tool names by replaying it client-side.
- `requestContext` contract for adapters is now established — Phase 5 server routes propagate `currentUser` (when available) into it; OSS / no-auth deployments populate `MASTRA_RESOURCE_ID_KEY = 'default'`.
- Phase 10 deletes the legacy `resolveStoredIntegrationTools` method and its four callsites; Phase 4 leaves them in place.
