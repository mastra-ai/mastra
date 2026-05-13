# Phase 6 — UI tools panel + connection picker (`packages/playground/src/domains/tool-providers/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 5 — Generic server routes](./phase-5-server-routes.md)
> Next phase: [Phase 7 — Form schema + mappers](./phase-7-form-mappers.md)

## Goal

The agent builder Tools panel works end-to-end with author-mode connections through a provider-agnostic UI. No mode toggle, no connect-required badge, no Composio-named components. `ConnectionPicker` is the single picker; `AddToolsDialog` lists tools across providers.

## Background

- **Why this phase is ordered here**: depends on Phase 5 routes + client. Drives Phase 7's form schema requirements.
- Spec sections to re-read:
  - ARCHITECTURE §9 "UI"
  - ARCHITECTURE §13 "Adapter design principles" (capability flags)
- Inherited blockers / constraints: respect `provider.capabilities.multipleConnectionsPerService` (single-select when false). Label validation must mirror server-side `superRefine` (case-insensitive unique, non-empty).

## Scope

### Playground
- `packages/playground/src/domains/tool-providers/` — new directory:
  - `hooks/use-tool-providers.ts` — list providers (cached).
  - `hooks/use-tool-services.ts` — per-provider tool services.
  - `hooks/use-tools.ts` — per-provider tools filtered by tool service.
  - `hooks/use-authorize.ts` — full popup + poll loop, returns `{ status, connectionId }`.
  - `hooks/use-connection-status.ts` — batched, React Query.
  - `components/connection-picker.tsx` — multi-select with label input + inline validation + reauthorize button. Single-select when capability flag is false.
  - `components/add-tools-dialog.tsx` — cross-provider catalog with provider chips.
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx` — rewrite section:
  - Use `ConnectionPicker` per tool service.
  - Empty-state row when connections are empty.
  - Block save when any tool-service-with-tools has zero connections.

### Drops
- `BindingModeToggle`, `AgentAuthModeRadio`, `ComposioConnectRequiredBadge`, `useComposioConnectBridge`, `useComposioConnections`, `connect-link-modal` (Composio-named), `AccountPicker`.

### Tests
- `packages/playground/src/domains/tool-providers/components/connection-picker.test.tsx` — label required, label unique (case-insensitive), single-select when capability is false, reauthorize click.
- `packages/playground/src/domains/agent-builder/.../tools-detail.test.tsx` — empty-state row, save-blocked rule.

**Explicitly NOT touched**: form mappers (Phase 7), `agentBuilderTool` schema (Phase 8), health pill (Phase 9).

## Acceptance truths

- [ ] `ConnectionPicker` rejects empty labels and case-insensitive duplicates inline.
- [ ] When `capabilities.multipleConnectionsPerService === false`, picker renders single-select with no "Add" button.
- [ ] Tools panel shows the empty-state row for a tool service with selected tools but no connections.
- [ ] Save is blocked (button disabled + tooltip) while any tool service has tools selected but zero connections.
- [ ] `AddToolsDialog` lists tools from all providers, filterable by provider chip.
- [ ] Repo-wide search for `BindingModeToggle`, `AccountPicker`, `ComposioConnectRequiredBadge` returns zero hits.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test connection-picker
pnpm --filter ./packages/playground test tools-detail
```

Manual smoke: add Gmail to an agent, click "+ Add connection", authorize, label as "Work", save, reload, picker shows "Work". Add a second connection "Personal", save, agent runs both renamed tools.

## Handoff to next phase

- Canonical hooks: `packages/playground/src/domains/tool-providers/hooks/*`. Phase 9 health pill reuses `use-connection-status`.
- `ConnectionPicker` is the single picker — Phase 7's form schema mirrors its validation rules.
- Save-blocked logic owned by `tools-detail.tsx`; Phase 7's mappers don't repeat the rule.
