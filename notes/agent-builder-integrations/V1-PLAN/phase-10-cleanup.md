# Phase 10 — Cleanup (revised after branch audit)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 9 — Health pill](./phase-9-health-pill.md)
> Next phase: [Phase 11 — Docs + changeset](./phase-11-docs-changeset.md)

## Current-branch reality

This phase was originally written assuming V1 was built **on top of the prototype branch**. The actual V1 branch (`yj/mm/v1-integrations-plan`) was started fresh from `yj/magnificent-marquess`, so most of the original "Deletes" section is already a no-op.

Audit results against the original acceptance grep list:

| Acceptance grep | Status |
|---|---|
| `packages/core/src/agent-builder/ee/composio-*` | ✅ does not exist |
| `packages/server/src/server/handlers/editor/builder/composio/` | ✅ does not exist |
| `connectionsByToolkit \| authMode \| authIdentity \| ConnectionPin \| ConnectionBinding` | ✅ zero hits |
| `PHASE-10-REMOVE` markers | ✅ zero hits |
| Composio-specific methods on editor client resource | ✅ none |
| Legacy `ToolProvider` interface marked `@deprecated` | ✅ already done in Phase 2 |
| Legacy `ComposioToolProvider` class refactored to thin shim | ❌ still 180 LOC, independent implementation |
| Storage rename `toolIntegrations` → `integrationTools` | ❌ blocked — name is occupied by a live legacy field |

## Goal (revised)

Eliminate the duplicate Composio SDK plumbing that exists in the legacy `ComposioToolProvider` class without breaking the two example apps and the e2e test file that still import it.

## Background

- Legacy `integrationTools` field is **not** prototype debris — it's a live storage path tied to the `ToolProvider` interface. `editor.namespaces.agent.resolveStoredIntegrationTools()` hydrates from it. Two example apps (`examples/agent`, `examples/agent-builder`) still construct `ComposioToolProvider`. So the field rename in the original plan would break running code.
- The legacy `ComposioToolProvider` class is **independent** of `ComposioToolIntegration` today — separate `Composio` clients, separate `userId` resolution, separate description override path. We have ~140 LOC of duplicated Composio SDK code.
- Composio SDK calls in `ComposioToolProvider` we want to dedupe:
  - `toolkits.get({})` (listToolkits) — same call in `ComposioToolIntegration.listAllToolServices`
  - `tools.getRawComposioTools(query)` (listTools) — same call in `ComposioToolIntegration.listAllTools`
  - `tools.get(userId, { tools })` via `MastraProvider` (resolveTools) — `ComposioToolIntegration.resolveTools` does the same with a `beforeExecute` modifier
- `getToolSchema(slug)` (calls `tools.getRawComposioToolBySlug`) has no equivalent on `ToolIntegration`. It's only used by legacy UI surfaces that we're not removing this phase, so the shim keeps the direct SDK call.

## Scope

### Thin-shim refactor — `packages/editor/src/providers/composio.ts`

Goal: turn the legacy class into a translation layer around `ComposioToolIntegration`. Keep its public surface (`info`, `listToolkits`, `listTools`, `getToolSchema`, `resolveTools`) unchanged, but delegate the actual SDK work.

Concrete plan:

1. Add a private `private readonly integration: ComposioToolIntegration` to the class. Constructor instantiates it from `config.apiKey`.
2. `info` — drop the manual literal, derive from `{ id: integration.id, name: integration.displayName }`. Keep the `description` literal since `ToolIntegration` doesn't expose a description.
3. `listToolkits()` — delegate to `integration.listToolServices({ search: undefined, perPage: undefined })` and map `ToolService` → legacy `ToolProviderToolkit`. Both shapes are `{ slug, name, description, icon }`, so the mapper is identity.
4. `listTools(options)` — delegate to `integration.listTools({ toolService: options?.toolkit, search: options?.search, page: options?.page, perPage: options?.perPage })` and map `ToolDescriptor` → legacy `ToolProviderToolInfo`. Drop the bespoke `ComposioToolListParams` building.
5. `getToolSchema(slug)` — keep current direct SDK call. Reuse the integration's private raw client by exposing a narrow internal accessor on `ComposioToolIntegration` (or expose the existing `apiKey` on a `protected` getter — see "Open detail" below).
6. `resolveTools(slugs, configs, options)` — translate the legacy `(slugs, configs, options)` triple into `ResolveToolsOpts`:
   - `toolSlugs` = `slugs`
   - `toolMeta` = `Object.fromEntries(Object.entries(configs ?? {}).map(([slug, cfg]) => [slug, { description: cfg.description }]))`
   - `connectionId` = pull `connectedAccountId` from the first matching `configs[slug]` (legacy MCP shape carries it per-tool). If absent, pass `''` (Composio falls back to user-scoped resolution).
   - `requestContext` = `options?.requestContext` (rewrapped via `RequestContext.fromJSON` if needed — match how `resolveStoredToolIntegrations` calls it today).
7. Add a `@deprecated` JSDoc on the class:
   ```ts
   /**
    * @deprecated Use `ComposioToolIntegration` from `@mastra/editor/composio`.
    * Scheduled for removal in the next coordinated breaking-change release.
    */
   ```
8. No runtime `console.warn` — the JSDoc plus Phase 11 changeset are the migration signal.

After this refactor, the only Composio SDK call sites in the repo are inside `ComposioToolIntegration` and the `getToolSchema` method on the shim.

### Open detail — getToolSchema SDK client access

`ComposioToolIntegration` keeps its raw client private. The shim either:
- **Option A** — keeps its own raw `Composio({ apiKey })` client just for `getToolSchema`. ~5 LOC of duplication, no API surface change.
- **Option B** — adds a `protected getRawClient()` to `BaseToolIntegration` or `ComposioToolIntegration` for subclasses/wrappers. Cleaner but expands the surface area.

**Recommendation: Option A.** `getToolSchema` is one method, used only on a deprecated class, and the 5-LOC client construction isn't worth widening the new interface.

### Storage rename — deferred to Phase 10b

The original plan called for `toolIntegrations` → `integrationTools` (because ARCHITECTURE.md names the field `integrationTools`). On this branch:

- `integrationTools` is occupied by the legacy `Record<string, StorageMCPClientToolsConfig>` field.
- Two example apps and live runtime code (`resolveStoredIntegrationTools`) depend on the legacy field.
- Renaming would require either (a) breaking the legacy path, (b) a temporary middle name, or (c) carrying a migration step. None of those make sense for V1.

Decision: **the storage field stays `toolIntegrations`** in V1. ARCHITECTURE.md gets a one-line note in Phase 11 explaining the naming compromise. The rename moves to Phase 10b (next coordinated major), at which point the legacy `ToolProvider` interface and `ComposioToolProvider` shim are also removed and the name slot frees up naturally.

### What is NOT touched

- Prototype EE files (all already gone)
- Prototype server handlers (all already gone)
- Storage field rename (deferred — see above)
- `notes/composio-research/` (Phase 11 owns documentation pointers)
- Phase 1.5 / Phase 2 compat shims for `MastraEditorConfig.toolProviders` Record-shape and `getToolProvider(id): T | undefined` — those stay until Phase 10b removes the legacy `ToolProvider` interface entirely
- The legacy `integrationTools` storage field and its hydration path — stays until Phase 10b

### Tests

- `packages/editor/src/providers/composio-integration.test.ts` — already covers `ComposioToolIntegration`, no changes needed
- `packages/editor/src/editor-integration-tools.test.ts` — has a `ComposioToolProvider e2e (real API, requires COMPOSIO_API_KEY)` describe block. Must continue to pass after the shim refactor — proves the wrapper preserves observable behavior. Use this block as the regression net rather than writing new unit tests for the shim.
- If any e2e expectation depends on legacy-specific quirks (e.g. response field ordering, error message wording), update the test, not the shim.

## Acceptance truths

- [ ] `packages/editor/src/providers/composio.ts` exists, is < 100 lines, and contains **at most one** direct `Composio` SDK construction (for `getToolSchema`).
- [ ] No `composio.connectedAccounts.*` or `composio.tools.get(...)` calls outside `ComposioToolIntegration`.
- [ ] Legacy `ComposioToolProvider` class has `@deprecated` JSDoc on its declaration.
- [ ] `examples/agent` and `examples/agent-builder` still build (the active `ComposioToolProvider` import in `examples/agent` continues to work).
- [ ] `pnpm --filter ./packages/editor test` green, including the legacy e2e block.
- [ ] `pnpm --filter ./packages/editor build` green.
- [ ] Sanity check: storage field names unchanged (`integrationTools` legacy, `toolIntegrations` new).

## Verification step

```
pnpm --filter ./packages/editor build
pnpm --filter ./packages/editor test
# Spot-check the shim is thin
wc -l packages/editor/src/providers/composio.ts
grep -cE 'new Composio\(' packages/editor/src/providers/composio.ts  # expect ≤ 1
grep -cE 'composio\.(tools|toolkits|connectedAccounts)\.' packages/editor/src/providers/composio.ts  # expect ≤ 1 (for getToolSchema)
```

All builds green. All tests green. SDK call sites collapsed to the integration class plus a single shim method for `getToolSchema`.

## Phase 10b — Scheduled removal (next coordinated major)

Not part of v1. Tracked here so the removal isn't forgotten. Targeted for the next team-wide breaking-change release of `@mastra/editor`. Removes:

- `packages/core/src/tool-provider/` (legacy `ToolProvider` interface + types)
- `packages/editor/src/providers/composio.ts` (legacy `ComposioToolProvider` thin shim)
- `editor.getToolProvider(id): ToolIntegration | undefined` returns-undefined variant. Rename `getToolProviderOrThrow` → `getToolProvider`.
- `MastraEditorConfig.toolProviders` Record-shape branch — narrow to `readonly ToolIntegration[]`.
- Legacy `integrationTools` storage field and its `resolveStoredIntegrationTools` hydration path. At this point we can safely rename `toolIntegrations` → `integrationTools`.
- Composio SDK call from `getToolSchema` (deleted with the shim).

Acceptance: `grep -rE 'ComposioToolProvider\b|\bToolProvider\b' packages/ client-sdks/` returns zero hits; storage field is `integrationTools` and matches ARCHITECTURE.md verbatim.

## Handoff to next phase

- One commit refactoring the legacy shim. Phase 11 (docs + changeset) closes V1. The Phase 11 changeset must call out:
  - `ComposioToolProvider` deprecation + migration to `ComposioToolIntegration`
  - Legacy `toolProviders` Record-shape config deprecation + migration to the array form
  - Both surfaces survive until the next coordinated `@mastra/editor` major
