# Phase 10 — Cleanup

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 9 — Health pill](./phase-9-health-pill.md)
> Next phase: [Phase 11 — Docs + changeset](./phase-11-docs-changeset.md)

## Goal

No dead code from the prototype remains. Every Composio-named EE file, old route handler, and prototype-shape reference is deleted. The compat layer is **trimmed**, not removed — the legacy `ToolProvider` / `ComposioToolProvider` public surface survives this phase as a `@deprecated` thin shim, scheduled for removal at the next coordinated major (see Phase 10b). Build is green across all packages.

## Background

- **Why this phase is ordered here**: needs every functional phase complete so deletions don't break a half-migrated path.
- Spec sections to re-read:
  - ARCHITECTURE §12 "What v1 drops from the prototypes"
  - ARCHITECTURE §14a "Backwards-compatibility window" (updated: legacy class survives Phase 10)
- **Deletion policy**: prototype-only EE code and the `connectionsByToolkit` storage shape go away now. Public API surface that external consumers may already import (`ComposioToolProvider`, `ToolProvider` interface, legacy `getToolProvider` semantics) is kept as a thin deprecation shim and dropped at the next coordinated team-wide major bump.

## Scope

### Deletes (prototype-only / never publicly exported)
- `packages/core/src/agent-builder/ee/composio-*` (every Composio-named EE file).
- `packages/server/src/server/handlers/editor/builder/composio/` (entire directory).
- Composio-specific methods on the client-js editor resource.
- Remaining `connectionsByToolkit`, `bindings`, `ConnectionPin`, `ConnectionBinding`, `authMode`, `authIdentity` references anywhere in the repo (outside of `notes/composio-research/` archives).

### Phase-2 compat shims (partial removal)

Phase 2 introduced two classes of shim:

1. **Pure-internal shims with no public consumer.** These come out now.
2. **Public-surface shims that external code may import.** These are kept and refactored into thin wrappers; their removal is Phase 10b (next major).

**Removed now (no external consumer):**
- `packages/core/src/editor/types.ts` — drop `getToolProviders()` plural method from `IMastraEditor`. The Record-shape config branch + warning stays (it surfaces user-facing config errors).
- `packages/editor/src/index.ts` — remove `getToolProviders()` plural method. Keep the Record-shape normalization branch (now without a deprecation warning — see 10b).

**Kept as thin shim (public consumer surface):**
- `packages/core/src/tool-provider/types.ts` — legacy `ToolProvider` interface stays as `@deprecated`. File is **not** deleted. The `type ToolProvider = ToolIntegration` alias stays.
- `packages/editor/src/providers/composio.ts` (legacy `ComposioToolProvider` class) — **refactored** into a thin wrapper around `ComposioToolIntegration`. The class continues to be re-exported from `@mastra/editor/composio` and `@mastra/editor`. See "Thin-shim refactor" below.
- `editor.getToolProvider(id): ToolIntegration | undefined` — kept (returns `undefined` on miss, legacy semantics). The throwing accessor `editor.getToolProviderOrThrow(id)` also stays.

### Thin-shim refactor

Goal: eliminate the duplicate Composio plumbing while keeping the legacy public class importable.

- `packages/editor/src/providers/composio.ts` — replace the ~180-line independent implementation with a wrapper:
  - Constructor instantiates a private `ComposioToolIntegration` internally.
  - `info` → maps from `integration.id` / `integration.displayName`.
  - `listToolkits()` → wraps `integration.listToolServices()` and maps to the legacy `ToolProviderToolkit[]` shape.
  - `listTools(opts)` → wraps `integration.listTools(opts)` (legacy parity already added in Phase 3 design).
  - `getToolSchema(slug)` → calls Composio SDK directly (no equivalent on `ToolIntegration`). This is the one bit of Composio SDK code that lives in the shim file.
  - `resolveTools(slugs, configs, opts)` → maps the legacy `(slugs, configs, opts)` signature to `integration.resolveTools({ toolSlugs, toolMeta, connectionId, requestContext })`. The legacy `configs` map carried a single `connectedAccountId` per toolkit — extract it as the new `connectionId`.
  - Add `@deprecated` JSDoc on the class with a `Scheduled for removal in @mastra/editor v3.0 (next coordinated breaking-change cycle).` line. No runtime `console.warn` (it's noisy and the JSDoc + changeset are sufficient signal).
- After this refactor, the **only** Composio SDK call sites in the repo are inside `ComposioToolIntegration` and the `getToolSchema` method on the legacy class.

### Storage field collapse
- `packages/core/src/storage/types.ts` — delete the legacy `integrationTools?: ...` field and rename `toolIntegrations` → `integrationTools` (ARCHITECTURE's canonical name).
- `packages/server/src/server/schemas/{stored-agents,agent-versions}.ts` — same rename + drop legacy schema.
- `packages/editor/src/namespaces/agent.ts` — delete the legacy hydration branch (the new branch becomes the only branch after rename).
- `client-sdks/client-js/src/types.ts` — same rename + drop legacy.

### PHASE-10-REMOVE markers

Every `PHASE-10-REMOVE` marker introduced in Phase 2 must be re-classified:
- **Markers on pure-internal shims** → comment + code removed in this phase.
- **Markers on public-surface shims** (legacy `ToolProvider` types, `getToolProvider` undefined-on-miss semantics, Record-shape config branch, `ComposioToolProvider` class) → comment renamed to `PHASE-10B-REMOVE`. They survive this phase.

Acceptance check changes from "grep PHASE-10-REMOVE returns zero" to "grep PHASE-10-REMOVE returns zero; grep PHASE-10B-REMOVE lists exactly the public-shim surface (≤ 10 hits, audited)."

### Notes
- `notes/composio-research/` stays as historical reference. Add a one-line note at the top of each doc pointing readers to `../agent-builder-integrations/ARCHITECTURE.md`.

### Tests
- No new tests; existing test suites are the verification.
- Adapter unit tests for `ComposioToolProvider` (legacy class) **must continue to pass** after the thin-shim refactor — proves the shim preserves observable behavior. If any test depends on legacy-specific quirks (e.g. response field ordering), update the test, not the shim.

**Explicitly NOT touched**: docs (Phase 11), changeset (Phase 11), the legacy `ComposioToolProvider` public class (refactored, not deleted), `ToolProvider` interface (deprecated, not deleted).

## Acceptance truths

- [ ] `packages/core/src/agent-builder/ee/composio-*` does not exist.
- [ ] `packages/server/src/server/handlers/editor/builder/composio/` does not exist.
- [ ] `grep -r 'connectionsByToolkit\|authMode\|authIdentity\|ConnectionPin\|ConnectionBinding' packages/ client-sdks/` returns zero hits.
- [ ] `grep -r 'PHASE-10-REMOVE' packages/ client-sdks/` returns zero hits.
- [ ] `grep -r 'PHASE-10B-REMOVE' packages/ client-sdks/` lists exactly the audited public-shim lines.
- [ ] `grep -r '\btoolIntegrations\b' packages/core/src/storage/ packages/server/src/server/schemas/` returns zero hits (renamed to `integrationTools`).
- [ ] `grep -r 'toolkit' packages/core/src/tool-provider/ packages/core/src/storage/types.ts packages/server/src/server/schemas/` returns zero hits (Composio's vendor noun must not leak into core/server).
- [ ] `packages/editor/src/providers/composio.ts` exists, is < 100 lines, and contains no direct `composio.connectedAccounts.*` calls (those live in `ComposioToolIntegration`).
- [ ] Existing legacy-class unit tests pass against the refactored thin shim.
- [ ] All four package builds clean.
- [ ] All test suites green.

## Verification step

```
pnpm --filter ./packages/core build
pnpm --filter ./packages/editor build
pnpm --filter ./packages/server build
pnpm --filter ./packages/playground build
pnpm --filter ./packages/core test
pnpm --filter ./packages/editor test
pnpm --filter ./packages/server test
pnpm --filter ./packages/playground test
grep -r 'connectionsByToolkit\|authMode\|authIdentity\|ConnectionPin\|ConnectionBinding' packages/ client-sdks/ || echo "OK: no legacy references"
grep -r 'PHASE-10-REMOVE' packages/ client-sdks/ || echo "OK: no pre-major shims left"
grep -r 'PHASE-10B-REMOVE' packages/ client-sdks/ | wc -l  # audit count
```

All builds green. All tests green. First grep returns "OK". Second grep returns "OK". Third grep is a small audited number (the public-shim survivors).

## Phase 10b — Scheduled removal (next coordinated major)

**Not part of v1.** Tracked here so the removal isn't forgotten.

Targeted for the next team-wide breaking-change release of `@mastra/editor` (typically once per year). Removes the public-surface shims kept in Phase 10:

- Delete `packages/core/src/tool-provider/` directory (legacy `ToolProvider` interface + alias).
- Delete `packages/editor/src/providers/composio.ts` (legacy `ComposioToolProvider` class).
- Drop the legacy export entry from `packages/editor/src/composio.ts` and `packages/editor/src/index.ts`.
- Narrow `MastraEditorConfig.toolProviders` from `Record<...> | readonly ToolIntegration[]` → `readonly ToolIntegration[]` only.
- Drop `editor.getToolProvider(id): ToolIntegration | undefined` (returns-undefined variant) and rename `getToolProviderOrThrow` → `getToolProvider`.
- Remove all `PHASE-10B-REMOVE` markers.
- Major version bump + changeset describing the migration (same migration guide as v1's Phase 11 changeset — the audience is just the late movers).

Acceptance: `grep -r 'PHASE-10B-REMOVE\|ComposioToolProvider\b\|\bToolProvider\b' packages/ client-sdks/` returns zero hits.

## Handoff to next phase

- Codebase reflects ARCHITECTURE.md verbatim **except** for the documented public-shim survivors. Phase 11 (docs + changeset) is the only remaining work to call v1 shippable. Phase 11 must call out the deprecation-with-scheduled-removal arc so external consumers know what to migrate and when.
