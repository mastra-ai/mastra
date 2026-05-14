# Phase 10 — Cleanup

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 9 — Health pill](./phase-9-health-pill.md)
> Next phase: [Phase 11 — Docs + changeset](./phase-11-docs-changeset.md)

## Goal

No dead code from the prototype remains. Every Composio-named EE file, old route handler, and legacy reference is deleted. Build is green across all packages.

## Background

- **Why this phase is ordered here**: needs every functional phase complete so deletions don't break a half-migrated path.
- Spec sections to re-read:
  - ARCHITECTURE §12 "What v1 drops from the prototypes"
- Inherited blockers / constraints: no normalizer code path, no back-compat shims, no `_deprecated` renames — delete outright.

## Scope

### Deletes
- `packages/core/src/agent-builder/ee/composio-*` (every Composio-named EE file).
- `packages/server/src/server/handlers/editor/builder/composio/` (entire directory).
- Composio-specific methods on the client-js editor resource.
- Remaining `connectionsByToolkit`, `bindings`, `ConnectionPin`, `ConnectionBinding`, `authMode`, `authIdentity` references anywhere in the repo (outside of `notes/composio-research/` archives).

### Phase-2 compat shims (Option B+ removal)
Every `PHASE-10-REMOVE` marker introduced in Phase 2 must be cleared:
- `packages/core/src/tool-provider/types.ts` — delete the `type ToolProvider = ToolIntegration` alias and the entire legacy `tool-provider/` module (it has no other content after Phase 2).
- `packages/core/src/editor/types.ts` — narrow `MastraEditorConfig.toolProviders` from `Record<...> | readonly ToolIntegration[]` to `readonly ToolIntegration[]` only. Drop `getToolProviders()` from `IMastraEditor`. Drop `getToolProvider(id): ToolIntegration | undefined`, keep only `getToolProviderOrThrow` renamed to `getToolProvider`.
- `packages/editor/src/index.ts` — remove the Record-shape normalization branch + deprecation warning. Remove `getToolProviders()` plural. Rename `getToolProviderOrThrow` → `getToolProvider` (now the only accessor, throwing semantics).
- Any remaining example app / kitchen-sink callsites using the Record shape must migrate to the array shape in the same PR.

### Storage field collapse
- `packages/core/src/storage/types.ts` — delete the legacy `integrationTools?: ...` field and rename `toolIntegrations` → `integrationTools` (ARCHITECTURE's canonical name).
- `packages/server/src/server/schemas/{stored-agents,agent-versions}.ts` — same rename + drop legacy schema.
- `packages/editor/src/namespaces/agent.ts` — delete the legacy hydration branch (the new branch becomes the only branch after rename).
- `client-sdks/client-js/src/types.ts` — same rename + drop legacy.

### Notes
- `notes/composio-research/` stays as historical reference. Add a one-line note at the top of each doc pointing readers to `../agent-builder-integrations/ARCHITECTURE.md`.

### Tests
- No new tests; existing test suites are the verification.

**Explicitly NOT touched**: docs (Phase 11), changeset (Phase 11).

## Acceptance truths

- [ ] `packages/core/src/agent-builder/ee/composio-*` does not exist.
- [ ] `packages/server/src/server/handlers/editor/builder/composio/` does not exist.
- [ ] `grep -r 'connectionsByToolkit\|authMode\|authIdentity\|ConnectionPin\|ConnectionBinding' packages/ client-sdks/` returns zero hits.
- [ ] `grep -r 'PHASE-10-REMOVE' packages/ client-sdks/` returns zero hits.
- [ ] `grep -r 'getToolProviderOrThrow' packages/ client-sdks/` returns zero hits (renamed to `getToolProvider`).
- [ ] `grep -r '\btoolIntegrations\b' packages/core/src/storage/ packages/server/src/server/schemas/` returns zero hits (renamed to `integrationTools`).
- [ ] `grep -r 'toolkit' packages/core/src/tool-provider/ packages/core/src/storage/types.ts packages/server/src/server/schemas/` returns zero hits (Composio's vendor noun must not leak into core/server).
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
```

All builds green. All tests green. Grep returns "OK: no legacy references".

## Handoff to next phase

- Codebase reflects ARCHITECTURE.md verbatim. Phase 11 (docs + changeset) is the only remaining work to call v1 shippable.
