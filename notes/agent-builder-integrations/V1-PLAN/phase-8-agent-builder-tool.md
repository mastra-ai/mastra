# Phase 8 — `agentBuilderTool` schema (`packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 7 — Form schema + mappers](./phase-7-form-mappers.md)
> Next phase: [Phase 9 — Health pill](./phase-9-health-pill.md)

## Goal

The LLM-facing builder tool can add and remove integration tools alongside regular tools / agents / workflows using a single `tools` array. The LLM only chooses ids from `availableAgentTools`; it never writes credentials, labels, or connection IDs. The human authorizes connections in the Tools panel (Phase 6 / 7).

## Background

- **Why this phase is ordered here**: Phase 7 landed the form shape (`toolIntegrations.<providerId>.tools` with denormalized `toolService`). Phase 8 teaches the builder tool to read/write that shape from a minimal LLM payload. Phase 9 (health pill) is independent.
- Spec sections to re-read:
  - ARCHITECTURE §10 "agentBuilderTool surface"
  - ARCHITECTURE §13 "Adapter design principles" (no leaky options to the LLM)
- Inherited blockers / constraints:
  - Schema rejects all credential-shaped fields (`label`, `connectionId`, `kind`).
  - Adding an integration tool to a service with no connections must NOT auto-create a placeholder connection — Phase 6's empty-state row handles that. Phase 7's `superRefine` will gate autosave until the human connects.
  - `toolService` is form-only metadata and is inferred by the routing layer, not provided by the LLM.

## Current branch reality

- Tool schema lives at `packages/playground/src/domains/agent-builder/mappers/agent-builder-tool/build-tool-schema.ts` and already gates `tools` behind `features.tools`. Today the array is `{ id, name }` and routes to `tools` / `agents` / `workflows` form keys via `route-tool-input.ts`.
- `AgentTool.type` is `'tool' | 'agent' | 'workflow'`. Integration tools have no representation yet.
- `useAgentBuilderTool` execute() calls `routeToolInputToFormKeys` and assigns to `formMethods.setValue('tools' | 'agents' | 'workflows', …)`. It does not touch `toolIntegrations`.
- `composio.bindings` / `composio.authMode` / `composio.authIdentity` never landed on this branch — no drops needed.

## Scope

### Types (`packages/playground/src/domains/agent-builder/types/agent-tool.ts`)
- Extend `AgentToolType` to `'tool' | 'agent' | 'workflow' | 'integration'`.
- On `AgentTool`, add optional `providerId?: string` and `toolService?: string` (populated only for `type === 'integration'`).
- `splitAgentTools` / `buildAgentTools` left alone — the integration write path lives in the new routing branch (see below); these helpers stay scoped to the legacy three buckets.

### Available agent tools assembly (caller of `buildAgentTools`)
- Out of scope here, but flag for the implementer: wherever the edit form composes `availableAgentTools`, push integration tools with `{ type: 'integration', providerId, toolService, id: toolSlug }`. Phase 6 already lists tools per integration via `useTools(providerId)`; Phase 8 only needs `AgentTool.type === 'integration'` to be visible in the catalog so the LLM can pick it. The actual wiring may already be partially in place — verify before adding.

### Schema (`build-tool-schema.ts`)
- Keep the unified `tools: Array<{ id, name }>` shape. No new sibling field, no `integrations.add/remove`. The LLM picks any id from `availableAgentTools` (which now includes integration tools).
- The `id` enum stays derived from `availableAgentTools.map(t => t.id)`, which transparently includes integration tool slugs.
- Schema must continue to reject unknown ids (enum-based). Round-trip: omitting an id from the array is the "remove" signal.

### Description (`build-tool-description.ts`)
- One short sentence noting integration tools may appear in the list and that the human handles authorization in the Tools panel. Never mention `connectionId`, `label`, `kind`, or auth flows.

### Routing (`route-tool-input.ts`)
- Extend `RoutedToolInput` with:
  ```ts
  toolIntegrations: Record<
    string,                           // providerId
    {
      tools: Record<string, { toolService: string }>;
      // connections intentionally omitted — write path is human-driven
    }
  >;
  ```
- For each input entry whose `AgentTool.type === 'integration'`, push into `toolIntegrations[providerId].tools[toolSlug] = { toolService }`. Inputs whose id is not in `availableAgentTools` continue to be silently dropped (existing behaviour).
- The mapper only sets `tools`; it does not invent `connections`. Empty-state UX from Phase 6/7 takes over.

### Execute (`use-agent-builder-tool.ts`)
- Capture the new `toolIntegrations` field from `routeToolInputToFormKeys`.
- Merge it into form state: preserve existing `formMethods.getValues('toolIntegrations')?.[providerId]?.connections` so connections the human already authorized survive a builder write. The LLM only owns `tools`; connections are read-modify-write merged from current form state.
- If the merged `toolIntegrations[providerId].tools` becomes empty AND `connections` is also empty, drop the providerId key entirely so the form doesn't carry empty shells.

### Tests
- `build-tool-schema.test.ts` — add cases:
  - LLM input including a `label`, `connectionId`, or `kind` field on a tool entry is stripped/rejected by the schema (extra keys ignored by zod default — assert routing layer doesn't act on them either if you keep them out of the schema).
  - Schema still parses an array containing an integration tool id (already covered indirectly by the enum case; pin it explicitly).
- `route-tool-input.test.ts` — add cases:
  - Mixed input (regular tool + agent + integration tool) routes into `tools`, `agents`, `toolIntegrations` correctly, with `toolService` carried from `availableAgentTools`.
  - Omitting a previously-routed integration tool id removes it on the next call (caller-driven, not stateful in the mapper).
  - Unknown ids are dropped.
- `use-agent-builder-tool.ts` (existing tests under `__tests__/`) — add a case:
  - Execute with an integration tool id when the form already has a connection for that service → connection is preserved.
  - Execute with an empty `tools` array when an integration tool was previously selected → that provider's `tools` empties out; connections still preserved.

**Explicitly NOT touched**: form schema (Phase 7 — already final), Tools panel UI (Phase 6), server, `agentBuilderTool` output shape.

## Acceptance truths

- [ ] LLM input array containing an integration tool id (e.g. `'gmail.fetch_emails'`) is accepted by the schema and written to `toolIntegrations.composio.tools['gmail.fetch_emails'] = { toolService: 'gmail' }`.
- [ ] LLM input containing `connectionId`, `label`, or `kind` on a tool entry is ignored — none of those keys reach form state.
- [ ] Omitting an integration tool id from a subsequent call removes it from `toolIntegrations[providerId].tools`.
- [ ] Existing human-authorized `connections` survive any builder-tool write.
- [ ] Adding an integration tool to a service with no connections leaves `connections` empty (no placeholder). Phase 7's `superRefine` then blocks autosave until the human connects.
- [ ] Description string does not mention `connectionId`, `label`, or auth flow specifics.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground vitest run src/domains/agent-builder/mappers/agent-builder-tool src/domains/agent-builder/components/agent-builder-edit/hooks/__tests__
```

All must pass. Manual smoke (after Phase 9 lands real wiring): builder agent prompt "Add Gmail fetch_emails to this agent" → tool service appears in Tools panel with empty-state row prompting the human to connect.

## Handoff to next phase

- LLM-facing surface finalized in `build-tool-schema.ts` (unified `tools` array, no new top-level field).
- Routing layer (`route-tool-input.ts`) is the single point that knows integration tools exist; everything downstream sees normalized form state.
- Builder agent flow: LLM picks tool ids → routing maps integration ids into `toolIntegrations` → human authorizes connections → Phase 7 unblocks save.
