# Phase 7 — Form schema + mappers (`packages/playground/src/domains/agent-builder/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 6 — UI tools panel + connection picker](./phase-6-ui-tools-panel.md)
> Next phase: [Phase 8 — `agentBuilderTool` schema](./phase-8-agent-builder-tool.md)

## Goal

Form ↔ storage round-trip is clean. The form state mirrors `integrationTools[providerId].connections` directly. `Connection.kind` is hardcoded to `'author'` on write. No prototype helpers survive.

## Background

- **Why this phase is ordered here**: depends on Phase 6's UI shape (connection rows, label validation). Phase 8 reads the same form schema.
- Spec sections to re-read:
  - ARCHITECTURE §6 "Storage on the agent"
  - ARCHITECTURE §9.2 "Form state ↔ storage mapping"
- Inherited blockers / constraints: `superRefine` rules must match the server schema (Phase 1) and `ConnectionPicker` (Phase 6) — three callsites, same rule, single source of truth in the schema.

## Scope

### Playground
- `packages/playground/src/domains/agent-builder/schemas.ts` — `AgentBuilderEditFormSchema` with `integrationTools` field. `superRefine` enforces required + case-insensitive unique labels per `connections[toolService]`.
- `packages/playground/src/domains/agent-builder/mappers/stored-agent-to-form-values.ts` — derive form state from `integrationTools[providerId].connections`.
- `packages/playground/src/domains/agent-builder/mappers/form-values-to-save-params.ts` — emit `integrationTools` in the new shape. `kind: 'author'` hardcoded.

### Drops
- `extractAuthMode`, `flattenBindings`, `ConnectionPin`, `ConnectionBinding`, `connectionsByToolkit`, `bindings`, `authMode`, `authIdentity` references.

### Tests
- `packages/playground/src/domains/agent-builder/mappers/__tests__/stored-agent-to-form-values.test.ts` — round-trip with N connections, `.passthrough()` preserves unknown fields on read.
- `packages/playground/src/domains/agent-builder/mappers/__tests__/form-values-to-save-params.test.ts` — emits `kind: 'author'` for every connection, label uniqueness rejection, `.passthrough()` preserves unknown fields on save.

**Explicitly NOT touched**: UI components, server routes, `agentBuilderTool` schema (Phase 8).

## Acceptance truths

- [ ] `AgentBuilderEditFormSchema.safeParse` rejects two connections sharing a case-insensitive label on the same `toolService`.
- [ ] `storedAgentToFormValues` round-trips N connections without losing unknown fields.
- [ ] `formValuesToSaveParams` writes `kind: 'author'` for every connection it emits.
- [ ] Repo-wide search for `extractAuthMode`, `flattenBindings`, `ConnectionPin`, `connectionsByToolkit` returns zero hits in the agent-builder domain.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test mappers
pnpm --filter ./packages/playground test schemas
```

All must pass. Round-trip + uniqueness tests green.

## Handoff to next phase

- Canonical form shape: `AgentBuilderEditFormSchema.integrationTools`. Phase 8 reads/writes via these mappers.
- Single uniqueness rule lives in `schemas.ts` — UI + server + LLM-facing schema (Phase 8) reference the same conceptual rule but enforce it independently at each boundary.
