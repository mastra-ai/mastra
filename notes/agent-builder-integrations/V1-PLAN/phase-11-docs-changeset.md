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
- `.changeset/<auto-name>.md` — **minor** bump for `@mastra/core`, `@mastra/editor`, `@mastra/server`, `@mastra/client-js`. (Not major: the public `ComposioToolProvider` class and `ToolProvider` interface are preserved as deprecated thin shims; no public TypeScript symbol is removed in v1.) Body explains:
  - New `@mastra/core/tool-integration` module is the canonical API. Recommend new code use `ComposioToolIntegration` + `readonly ToolIntegration[]` config shape.
  - **Deprecated, kept working in v1**:
    - `ComposioToolProvider` class — refactored into a thin wrapper around `ComposioToolIntegration`. Continues to work. `@deprecated` JSDoc says `Scheduled for removal in @mastra/editor v3.0 (next coordinated breaking-change cycle).`
    - `ToolProvider` interface (`@mastra/core/tool-provider`) — kept as `type ToolProvider = ToolIntegration` alias.
    - `MastraEditorConfig.toolProviders` accepts both `Record<string, ToolProvider>` and `readonly ToolIntegration[]`.
    - `editor.getToolProvider(id)` returns `undefined` on miss (legacy semantics). New code should use `editor.getToolProviderOrThrow(id)`.
  - **Removed in v1** (prototype-only, never publicly exported): `connectionsByToolkit`, `bindings`, `ConnectionPin`, `ConnectionBinding`, `authMode`, `authIdentity` references; Composio-named EE files; `/tool-providers/*` routes replaced by `/tool-integrations/*`; `getToolProviders()` plural method.
  - **Scheduled for removal in `@mastra/editor` v3.0** (next coordinated team-wide major, see Phase 10b in the v1 plan): every deprecated surface above. Consumers should migrate during the v1.x release line.
  - `StorageMCPClientToolsConfig` → `integrationTools[providerId] = { tools, connections }`.
  - Prototype agents must be re-saved (no auto-migration).
  - OSS / no-auth fallback `userId = 'default'`.
- Migration guide (linked from the changeset body, lives in `docs/.../tool-providers.mdx` migration section): side-by-side before/after for the four common patterns (config shape, class name, `getToolProvider` semantics, server routes). Audience is users who want to migrate now or before v3.0.

### Tests
- `pnpm --filter ./docs build` — docs site builds clean.

**Explicitly NOT touched**: source code (locked in by Phase 10).

## Acceptance truths

- [ ] `docs/.../tool-providers.mdx` exists and renders.
- [ ] Changeset entry exists with **minor** bump for the four packages.
- [ ] Changeset body includes the deprecation-with-scheduled-removal note and migration guide link.
- [ ] Migration guide section in `docs/.../tool-providers.mdx` covers config shape, class name, `getToolProvider` semantics, and server routes.
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
