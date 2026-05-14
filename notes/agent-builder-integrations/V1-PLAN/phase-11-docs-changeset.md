# Phase 11 — Docs + changeset

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 10 — Cleanup](./phase-10-cleanup.md)
> Next phase: —

## Goal

Public docs cover the `ToolIntegration` / `BaseToolIntegration` / registry API. A changeset entry exists with a clear migration note for users on prototype-shape agents.

## Background

- **Why this phase is ordered here**: last. Docs reflect the final shipped code, not the in-flight plan.
- Spec sections to re-read:
  - ARCHITECTURE §3 "Core types"
  - ARCHITECTURE §4 "BaseToolIntegration"
  - ARCHITECTURE §5 "Registry"
  - ARCHITECTURE §14 "Auth dependency"
- Inherited blockers / constraints: changeset must call out the breaking storage shape change. Follow `docs/AGENTS.md` and `docs/styleguides`.

## Scope

### Docs
- `docs/.../tool-providers.mdx` — new. Public API for `ToolIntegration`, `BaseToolIntegration`, `MastraEditor` registry, `'default'` OSS fallback. Worked Composio example.
- `docs/.../agent-builder/integrations.mdx` — link from existing agent-builder docs.

### Changeset
- `.changeset/<auto-name>.md` — major bump for `@mastra/core`, `@mastra/editor`, `@mastra/server`, `@mastra/client-js`. Body explains:
  - New `@mastra/core/tool-integration` module replaces old `ToolProvider` interface.
  - **Compat window (Phase 2 → Phase 10)**: For one release cycle, `MastraEditorConfig.toolProviders` accepted both the legacy `Record<string, ToolProvider>` shape and the new `readonly ToolIntegration[]` shape, `getToolProvider` returned `undefined` on miss, and `ToolProvider` was a deprecated type alias for `ToolIntegration`. v1 removes all of these — consumers MUST migrate to the array shape and the throwing `getToolProvider`.
  - `StorageMCPClientToolsConfig` → `integrationTools[providerId] = { tools, connections }`.
  - Prototype agents must be re-saved (no auto-migration).
  - OSS / no-auth fallback `userId = 'default'`.

### Tests
- `pnpm --filter ./docs build` — docs site builds clean.

**Explicitly NOT touched**: source code (locked in by Phase 10).

## Acceptance truths

- [ ] `docs/.../tool-providers.mdx` exists and renders.
- [ ] Changeset entry exists with major bump for the four packages.
- [ ] Changeset body includes the migration note.
- [ ] Docs site builds clean.
- [ ] Changeset passes `pnpm changeset status`.

## Verification step

```
pnpm --filter ./docs build
pnpm changeset status
```

All must pass. v1 is shippable when this phase merges.

## Handoff to next phase

- v1 is complete. Follow-ups tracked in the [README's Out of scope section](./README.md#out-of-scope-deferred):
  - v1.5: invoker mode + Connect badge + memory `resourceId` switch + Arcade adapter + white-label OAuth.
  - v2: platform mode + per-tool overrides.
