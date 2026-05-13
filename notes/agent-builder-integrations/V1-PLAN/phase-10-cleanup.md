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

### Notes
- `notes/composio-research/` stays as historical reference. Add a one-line note at the top of each doc pointing readers to `../agent-builder-integrations/ARCHITECTURE.md`.

### Tests
- No new tests; existing test suites are the verification.

**Explicitly NOT touched**: docs (Phase 11), changeset (Phase 11).

## Acceptance truths

- [ ] `packages/core/src/agent-builder/ee/composio-*` does not exist.
- [ ] `packages/server/src/server/handlers/editor/builder/composio/` does not exist.
- [ ] `grep -r 'connectionsByToolkit\|authMode\|authIdentity\|ConnectionPin\|ConnectionBinding' packages/ client-sdks/` returns zero hits.
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
