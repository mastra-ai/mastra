# Phase 8 — `agentBuilderTool` schema (`packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 7 — Form schema + mappers](./phase-7-form-mappers.md)
> Next phase: [Phase 9 — Health pill](./phase-9-health-pill.md)

## Goal

The LLM-facing builder tool can add and remove integration tools but cannot write credentials, labels, or connection IDs. The human authorizes connections in the Tools panel.

## Background

- **Why this phase is ordered here**: form state from Phase 7 is the input/output surface. Health pill (Phase 9) is independent.
- Spec sections to re-read:
  - ARCHITECTURE §10 "agentBuilderTool surface"
  - ARCHITECTURE §13 "Adapter design principles" (no leaky options to the LLM)
- Inherited blockers / constraints: schema rejects all credential-shaped fields. Adding a tool to a tool service with no connections must NOT auto-create a placeholder connection — Phase 6's empty-state row handles that.

## Scope

### Playground
- `packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/build-tool-schema.ts` — `integrations` field per ARCHITECTURE §10:
  ```ts
  integrations?: {
    add?: Array<{ providerId: string; toolSlug: string }>;
    remove?: Array<{ providerId: string; toolSlug: string }>;
  }
  ```
- `build-tool-description.ts` — describe `integrations.add` / `integrations.remove`. Mention that the human authorizes connections in the Tools panel.
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool.ts` — apply adds/removes to form state. Never write `label` / `connectionId` / `kind`.

### Drops
- `composio.bindings`, `composio.authMode`, `composio.authIdentity` from the LLM-facing schema.

### Tests
- `packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/__tests__/build-tool-schema.test.ts` — schema rejects `label` / `connectionId` / `kind` from the LLM input. Round-trip `add` then `remove` for the same tool restores state.

**Explicitly NOT touched**: form schema (Phase 7), UI (Phase 6), server.

## Acceptance truths

- [ ] LLM input containing `connectionId`, `label`, or `kind` is rejected by the schema.
- [ ] `integrations.add: [{ providerId: 'composio', toolSlug: 'gmail.fetch_emails' }]` appends the tool to `integrationTools.composio.tools`.
- [ ] `integrations.remove` is the inverse of `add` on the same payload.
- [ ] Adding a tool to a tool service with no connections leaves `connections` empty (no placeholder created).
- [ ] Description string does not mention `connectionId`, `label`, or auth flow specifics.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test build-tool-schema
```

All must pass. Manual smoke: builder agent prompt "Add Gmail fetch_emails to this agent" → tool service appears in Tools panel with empty-state row prompting authorization.

## Handoff to next phase

- LLM-facing surface finalized in `build-tool-schema.ts`. Health pill (Phase 9) doesn't touch it.
- Builder agent flow: LLM adds tools → human authorizes connections → save unblocks.
