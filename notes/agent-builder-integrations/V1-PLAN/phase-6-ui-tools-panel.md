# Phase 6 — UI tools panel + connection picker (`packages/playground/src/domains/tool-integrations/`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 5 — Generic server routes](./phase-5-server-routes.md)
> Next phase: [Phase 7 — Form schema + mappers](./phase-7-form-mappers.md)

## Goal

Stand up the provider-agnostic UI layer for `ToolIntegration`: hooks against the Phase 5 `/api/tool-integrations/*` routes, a single `ConnectionPicker`, and a cross-provider `AddToolsDialog`. The Tools panel renders the picker per tool service and an empty-state row when a tool service has tools but no connections.

Wiring the picker into the form (read/write `toolIntegrations[providerId].connections`, "save blocked" gating, label `superRefine`) is owned by **Phase 7**. Phase 6 ships the components and hooks with prop-driven state so Phase 7 can plug them into `react-hook-form` without rewrites.

## Background

- **Why this phase is ordered here**: depends on Phase 5 routes + client. Drives Phase 7's form schema requirements.
- Spec sections to re-read:
  - ARCHITECTURE §9 "UI"
  - ARCHITECTURE §13 "Adapter design principles" (capability flags)
- Inherited blockers / constraints:
  - Respect `integration.capabilities.multipleConnectionsPerService` (single-select when `false`, no "Add" button).
  - Inline label validation must mirror the rule that will land in Phase 7 / Phase 1 schema: non-empty, ≤32 chars, case-insensitive unique per `toolService`.
  - Legacy `tool-providers/` directory and `client.getToolProvider(id)` stay in place; the legacy CMS page (`agents/components/agent-cms-pages/tools-page.tsx`) keeps using them until Phase 10b.

## Scope

### Playground — new directory `packages/playground/src/domains/tool-integrations/`

- `hooks/use-tool-integrations.ts` — `client.listToolIntegrations()` (cached).
- `hooks/use-tool-services.ts` — `client.getToolIntegration(id).listToolServices()`.
- `hooks/use-tools.ts` — `client.getToolIntegration(id).listTools({ toolService, search, page, perPage })`.
- `hooks/use-authorize.ts` — calls `client.getToolIntegration(id).authorize(...)`, opens popup, polls `getAuthStatus(authId)`, returns `{ status, connectionId }` on success.
- `hooks/use-connection-status.ts` — batched `client.getToolIntegration(id).getConnectionStatus({ items })` via React Query (reused by Phase 9 health pill).
- `components/connection-picker.tsx` — controlled component. Multi-select when `capabilities.multipleConnectionsPerService === true`, single-select otherwise. Inline label input + validation, "+ Add connection" button (multi only), per-row reauthorize button. Calls `useAuthorize` on connect/reauth.
- `components/add-tools-dialog.tsx` — cross-provider catalog with provider chips, free-text search wired to `use-tools`.
- `index.ts` — barrel.

### Playground — Tools panel

- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx`:
  - Render `ConnectionPicker` per selected tool service (props-driven; no `react-hook-form` reads — Phase 7 wires that in).
  - Render the **empty-state row** when a tool service has tools selected but zero connections.
  - Surface a prop callback (`onConnectionsInvalid`) that Phase 7 hooks into the save-block toggle.

### Legacy left in place (no deletes this phase)

- `packages/playground/src/domains/tool-providers/` (hooks + components, including `IntegrationToolsSection`).
- `packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx` consumer.
- `client.getToolProvider(id)` / `client.listToolProviders()`.
- All of the above are scheduled for removal in Phase 10b.

### Tests

- `packages/playground/src/domains/tool-integrations/components/connection-picker.test.tsx`:
  - Rejects empty labels inline.
  - Rejects case-insensitive duplicate labels inline.
  - Single-select rendering when `capabilities.multipleConnectionsPerService === false` (no "+ Add" button).
  - Reauthorize button click invokes `useAuthorize` for the right `connectionId`.
- `packages/playground/src/domains/tool-integrations/components/add-tools-dialog.test.tsx`:
  - Lists tools from multiple providers, filterable by provider chip.
- `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/__tests__/tools-detail.test.tsx`:
  - Empty-state row renders when `connections.length === 0` for a tool service with tools.
  - `onConnectionsInvalid(true)` fires when any tool service with tools has zero connections.

**Explicitly NOT touched**: form schema + mappers (Phase 7 — owns `toolIntegrations` field, `superRefine`, save-block wiring), `agentBuilderTool` schema (Phase 8), health pill (Phase 9), legacy `tool-providers/` directory (Phase 10b).

## Acceptance truths

- [ ] `useToolIntegrations` returns the list from `/api/tool-integrations` and is cached by React Query.
- [ ] `useAuthorize` completes the popup + poll loop and resolves with `{ status: 'completed', connectionId }`.
- [ ] `ConnectionPicker` rejects empty labels and case-insensitive duplicates inline (mirrors the Phase 7 / Phase 1 rule).
- [ ] When `capabilities.multipleConnectionsPerService === false`, picker renders single-select with no "+ Add connection" button.
- [ ] Tools panel shows the empty-state row for a tool service with selected tools but zero connections.
- [ ] `tools-detail.tsx` fires `onConnectionsInvalid(true)` while any tool service has tools but zero connections (Phase 7 wires this to disable Save).
- [ ] `AddToolsDialog` lists tools from all integrations, filterable by provider chip.
- [ ] No imports of `client.getToolProvider` / `listToolProviders` from anything under `packages/playground/src/domains/tool-integrations/` or the agent-builder Tools panel.

## Verification step

```
pnpm --filter ./packages/playground build
pnpm --filter ./packages/playground test connection-picker
pnpm --filter ./packages/playground test add-tools-dialog
pnpm --filter ./packages/playground test tools-detail
```

Manual smoke (deferred until Phase 7 finishes save wiring): add Gmail to an agent, click "+ Add connection", authorize, label as "Work", second connection "Personal", save, reload, picker shows both rows; agent runs both renamed tools.

## Handoff to next phase

- Canonical hooks: `packages/playground/src/domains/tool-integrations/hooks/*`. Phase 9 health pill reuses `use-connection-status`.
- `ConnectionPicker` is the single picker — Phase 7's form schema mirrors its inline validation rules.
- Phase 7 owns: adding `toolIntegrations` to `AgentBuilderEditFormSchema`, `superRefine`, mapping `react-hook-form` field state into the picker's props, and wiring `onConnectionsInvalid` into the Save button.
