# Phase 7 — Form schema + mappers + edit-form wiring (`packages/playground/src/domains/agent-builder/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 6 — UI tools panel + connection picker](./phase-6-ui-tools-panel.md)
> Next phase: [Phase 8 — `agentBuilderTool` schema](./phase-8-agent-builder-tool.md)

## Goal

End-to-end form ↔ storage round-trip. The agent-builder edit form owns a typed `toolIntegrations` field; mappers translate cleanly to/from `StoredToolIntegrationConfig`. `ToolsDetail` (built in Phase 6) is wired to that form field so the UI is **actually reachable** from the agent-builder edit route. After Phase 7, a developer with `ComposioToolIntegration` registered can open an agent, add an integration tool, connect an account, and save — without any UI dead-ends.

## Background

- **Why ordered here**: depends on Phase 6's UI props (`toolIntegrationServices`, `onConnectionsChange`, `onConnectionsInvalid`); Phase 8's LLM-facing tool schema reads from the same form shape.
- Spec sections:
  - ARCHITECTURE §6 "Storage on the agent" — `StoredToolIntegrationConfig` shape
  - ARCHITECTURE §9.1 "Tools panel" — picker behaviour
  - ARCHITECTURE §9.2 "Authorize flow" — save-block invariants
- Inherited constraints:
  - Label rules must match Phase 1's `connectionSchema.label` (required, ≤ 32 chars, `[A-Za-z0-9 _-]+`, case-insensitive unique per `(toolService)`).
  - `kind` is hardcoded to `'author'` in v1 (`'invoker'` reserved for v1.5, `'platform'` for v2).
  - Save must be blocked while any `toolService` with selected tools has zero connections.

## Current branch reality

- Storage field on the agent is **`toolIntegrations`** (new, parallel to legacy `integrationTools`). Server schemas, client types, and storage adapters are all in place from Phases 1, 1.5, 5.
- `AgentBuilderEditFormSchema` currently has no `toolIntegrations` field.
- `formValuesToSaveParams` and `storedAgentToFormValues` do not handle `toolIntegrations`.
- `useSaveAgent` does not pass `toolIntegrations` to `updateStoredAgent.mutateAsync`.
- `ToolsDetail` props exist (`toolIntegrationServices`, `onConnectionsChange`, `onConnectionsInvalid`) but are not consumed anywhere — the parent edit view passes nothing.
- No prototype symbols (`extractAuthMode`, `flattenBindings`, `ConnectionPin`, `connectionsByToolkit`, `authIdentity`) exist on this branch — there is nothing to drop.

## Scope

### Schema (`schemas.ts`)
- Add `toolIntegrations` field to `AgentBuilderEditFormSchema`:
  ```ts
  toolIntegrations: z
    .record(
      z.string(), // providerId
      z.object({
        tools: z.record(
          z.string(), // tool slug
          z.object({
            toolService: z.string(),       // denormalized on the entry — see "Design decisions"
            description: z.string().optional(),
          }).passthrough(),
        ),
        connections: z.record(z.string(), z.array(connectionFormSchema)),
      }).passthrough(),
    )
    .optional()
  ```
- Define `connectionFormSchema` mirroring `Connection` from Phase 1: `{ kind: 'author', toolService, connectionId, label }`. `kind` is a literal `'author'` in v1.
- `superRefine`: per `(providerId, toolService)`, label set must be non-empty, each ≤ 32 chars, match `[A-Za-z0-9 _-]+`, and case-insensitive unique.
- `superRefine`: every `tools[slug]` entry must have at least one connection in `connections[entry.toolService]`. **No slug parsing** — the form entry carries its own `toolService` (see Q1 below).

### Mappers
- `mappers/stored-agent-to-form-values.ts` — read `storedAgent.toolIntegrations`:
  - Static value → flat form value (denormalize `toolService` onto each tool entry by joining `tools` against the matching `connections` key).
  - **Conditional variant → return `undefined`** for the field. Matches how `model` handles variants (see Q2 below).
  - Preserves unknown fields on inner records via zod `.passthrough()`.
- `mappers/form-values-to-save-params.ts`:
  - Extend `SaveParams` interface with `toolIntegrations?: Record<string, StoredToolIntegrationConfig>`.
  - Emit `toolIntegrations` only when the form value is non-empty.
  - Strip the form-only `toolService` field off each `tools[slug]` entry before emitting (storage keeps `toolService` on connections only — matches Phase 1's storage shape).
  - Hardcode `kind: 'author'` on every `Connection` emitted.

### Save hook (`hooks/use-save-agent.ts`)
- Pass `toolIntegrations: params.toolIntegrations` to `updateStoredAgent.mutateAsync(...)`.
- **Conditional-preservation guard**: if the *incoming* stored value was a conditional variant (form value was therefore `undefined` from the mapper), do **not** overwrite it with `undefined`. Read the original stored shape, pass it through unchanged. Prevents silent data loss for conditional configs that the v1 form cannot represent. (See Q2 below.)

### Edit-form wiring
- Find the parent component that renders `<ToolsDetail />` in the agent-builder edit route (search for `<ToolsDetail` / `tools-detail`).
- Pass:
  - `toolIntegrationServices` — derived from the **form's** `toolIntegrations` value, grouped by `toolService`.
  - `onConnectionsChange(providerId, toolService, connections)` → `form.setValue('toolIntegrations.{providerId}.connections.{toolService}', connections)` and re-validate.
  - `onConnectionsInvalid(invalid)` → toggles a form-level invalid flag (consumed by submit button + picker inline error).
- Wire `AddToolsDialog` submission to write `form.setValue('toolIntegrations.{providerId}.tools.{slug}', { toolService, description })`.
- **Submit-block UX** (see Q3 below):
  - Submit button is **disabled** when `invalid === true`.
  - `ConnectionPicker` shows inline error text on rows that have selected tools but zero connections.
  - Submit button carries a tooltip explaining *why* it's disabled when hovered in the invalid state.

### Tests
- `mappers/__tests__/stored-agent-to-form-values.test.ts`
  - Round-trips a stored agent with N connections per toolService.
  - `.passthrough()` keeps an unknown `metadata` field on `connections[toolService][i]` after a read→write cycle.
  - Conditional-variant `toolIntegrations` → form field is `undefined`.
  - Each `tools[slug]` form entry carries the correct `toolService`.
- `mappers/__tests__/form-values-to-save-params.test.ts`
  - Emits `kind: 'author'` for every connection.
  - Strips the form-only `toolService` from `tools[slug]` before emitting.
  - Omits `toolIntegrations` entirely when the form value is empty/undefined.
  - Preserves unknown fields on tool-meta and connection entries.
- `hooks/__tests__/use-save-agent.test.ts` (or extend existing)
  - When `toolIntegrations` was conditional in storage and `undefined` in the form, `updateStoredAgent.mutateAsync` is called with the **original** stored conditional value (preserved).
- `schemas` tests
  - Rejects two connections with case-insensitive equal labels on the same `toolService`.
  - Rejects a label longer than 32 chars.
  - Rejects a label with a `/` or other illegal character.
  - Rejects a selected tool whose denormalized `toolService` has zero connections.
  - Accepts the empty case (no `toolIntegrations`).
- Edit-form wiring smoke test (`agent-builder-edit/__tests__/tool-integrations-wiring.test.tsx`)
  - Renders the edit form with a mocked `toolIntegrationServices`.
  - Picking a tool from `AddToolsDialog` updates form state (with `toolService` populated).
  - Removing the last connection while a tool is selected → `onConnectionsInvalid(true)` fires.
  - Submit button is `disabled` while invalid; inline error renders on the affected picker row; hovering the disabled button reveals an explanatory tooltip.

**Explicitly NOT touched**: server routes, `agentBuilderTool` schema (Phase 8), health pill (Phase 9), legacy `integrationTools` mapper code (still used by old flows).

## Design decisions

### Q1 — Tool slug → toolService is **denormalized on the form entry**

`tools[slug]` carries its own `toolService` field. No string-splitting on `.`, no side-channel map threaded through `superRefine`.

Why:
- Single source of truth lives on the entry itself.
- Mirrors §6 of ARCHITECTURE which already denormalizes `toolService` onto each `Connection` "for clarity".
- Survives provider slugs without dots (e.g. `notion_search`) — no Composio-shaped convention baked in.
- `AddToolsDialog` already has `toolService` in hand when the user picks a tool; writing it costs nothing.
- The field is stripped on save (storage shape stays clean — see `formValuesToSaveParams`).

### Q2 — Conditional `toolIntegrations` → `undefined` in form + preserve-on-save guard

The mapper returns `undefined` for conditional variants (matches `model` behaviour). `useSaveAgent` carries a guard that, if the form value is `undefined` *and* the stored value was conditional, passes the original stored value through unchanged.

Why:
- v1 has no UI surface for conditional-config integrations — the only paths that produce one are the LLM-facing `agentBuilderTool` and hand-edited JSON.
- Plain "skip" (no guard) silently nukes the field on save. Flattening a single variant is lossy and confusing. A "managed by code" banner is its own UX scope.
- The guard is ~5 lines, gives strict round-trip safety, and is cheaper than building a conditional-config editor.

### Q3 — Submit block = disabled button + inline picker error + tooltip-on-disabled

When `onConnectionsInvalid(true)` fires, the submit button is disabled, the affected `ConnectionPicker` row shows an inline error, and hovering the disabled button reveals a tooltip explaining the block.

Why:
- Matches every other form-validation pattern in the agent-builder edit route (consistency).
- Inline error gives locality of failure; tooltip answers "why is this disabled?" without a toast interrupting flow.
- A toast (alternative) is the wrong shape — this isn't an event, it's persistent state.
- `onConnectionsInvalid` already exists from Phase 6, so the inline-error path is free.

## Acceptance truths

- [ ] `AgentBuilderEditFormSchema.safeParse` rejects two connections sharing a case-insensitive label on the same `toolService`.
- [ ] `AgentBuilderEditFormSchema.safeParse` rejects a selected tool whose denormalized `toolService` has zero connections.
- [ ] `storedAgentToFormValues` round-trips N connections without losing unknown fields, and every `tools[slug]` entry has the correct `toolService` populated.
- [ ] `formValuesToSaveParams` writes `kind: 'author'` for every connection, strips the form-only `toolService` off tool entries, and omits the field when empty.
- [ ] `useSaveAgent` forwards `toolIntegrations` to `updateStoredAgent.mutateAsync`; preserves the original stored value when the incoming form value is `undefined` and the stored shape was conditional.
- [ ] Opening the agent-builder edit route renders `ToolsDetail` with services derived from the form value; picking a tool persists to form state with `toolService`; submit is disabled with inline error + tooltip when any tool-with-tools has zero connections.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test mappers
pnpm --filter ./packages/playground test schemas
pnpm --filter ./packages/playground test tool-integrations-wiring
```

All green. Manual smoke (deferred until Phase 9 example app is configured): open an agent with `ComposioToolIntegration` registered, add a Gmail tool, connect a Google account, save, reload — the agent's `toolIntegrations.composio.connections.gmail[0]` round-trips.

## Handoff to next phase

- Canonical form shape: `AgentBuilderEditFormSchema.toolIntegrations`. Phase 8 (`agentBuilderTool`) reads selected tools from the same form value via a thin selector.
- Save-block rule lives in `schemas.ts` as the single source of truth; UI mirrors it via `onConnectionsInvalid`; server independently enforces it through Phase 1's Zod schemas.
- `kind: 'author'` is hardcoded in one place (`formValuesToSaveParams`). Phase 7.5 (v1.5) will introduce the `invoker` toggle by lifting this into the form.
