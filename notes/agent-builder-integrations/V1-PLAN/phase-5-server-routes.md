# Phase 5 — Generic server routes (`/api/tool-integrations/*`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 4 — Runtime fan-out](./phase-4-runtime-fanout.md)
> Next phase: [Phase 6 — UI tools panel + connection picker](./phase-6-ui-tools-panel.md)

## Goal

A provider-agnostic `/api/tool-integrations/*` namespace exists end-to-end. Each handler delegates to the registered `ToolIntegration` via `editor.getToolIntegrationOrThrow(id)`. The new namespace covers the full v1 surface: list, tool services, tools (with pagination + search), authorize, auth-status, batch connection-status, and health.

The legacy `/api/tool-providers/*` namespace is **not** deleted in this phase. It rides the Phase 2 compatibility shim (`MastraEditor.getToolProvider`, `getToolProviders`) and stays in place until Phase 10b's scheduled removal at the next major. This mirrors the decision we made for `ComposioToolProvider`.

## Background

- **Why this phase is ordered here**: Phase 6 UI consumes these routes. No dependency on Phase 4's runtime — these are catalog + auth surface, not tool execution.
- Spec sections to re-read:
  - ARCHITECTURE §7 "Server routes"
  - ARCHITECTURE §13 "Adapter design principles"
  - ARCHITECTURE "Backwards-compatibility window" (legacy `/tool-providers/*` survives Phase 10a)
- Inherited blockers / constraints:
  - Use `editor.getToolIntegrationOrThrow(id)` (Phase 2 added this; it throws `UnknownIntegrationError`).
  - Translate `UnknownIntegrationError` → 404 in centralized error handling.
  - New `ToolIntegration` catalog methods return wrapped results (`{ data, pagination }`). Schemas must match.
  - No prototype EE routes exist on this branch — the doc previously referenced `/api/editor/builder/composio/*`, which only lived on the prototype. Nothing to delete.

## Scope

### Server

- `packages/server/src/server/handlers/tool-integrations.ts` — **new file**, one handler per route. Each handler:
  - Reads editor from `mastra.getEditor()`, 500s if missing.
  - Resolves provider via `editor.getToolIntegrationOrThrow(providerId)`.
  - Catches `UnknownIntegrationError` and rethrows as `HTTPException(404)`.
  - Routes:
    - `GET /tool-integrations` → `{ integrations: [{ id, displayName, capabilities }] }`
    - `GET /tool-integrations/:providerId/tool-services` → `await integration.listToolServices()` (wrapped result, pass through).
    - `GET /tool-integrations/:providerId/tools?toolService=&search=&page=&perPage=` → `await integration.listTools({ toolService?, search?, page?, perPage? })` (wrapped result).
    - `POST /tool-integrations/:providerId/authorize` body `{ toolService, connectionId?, toolName? }` → `await integration.authorize(opts)` → `{ url, authId }`.
    - `GET /tool-integrations/:providerId/auth-status/:authId` → `await integration.getAuthStatus(authId)` → `{ status: 'pending'|'completed'|'failed', connectionId?, error? }`.
    - `POST /tool-integrations/:providerId/connection-status` body `{ items: [{ toolService, connectionId }] }` → `await integration.getConnectionStatus(items)` → `{ items: [{ toolService, connectionId, connected, status?, error? }] }`. Exactly one upstream SDK call per service (Composio batches by `toolkit`).
    - `GET /tool-integrations/:providerId/health` → `await integration.getHealth()` → `{ ok, message?, details? }`.

- `packages/server/src/server/schemas/tool-integrations.ts` — **new file**. Path params, query params, request bodies, response schemas. Reuse the wrapped-result shapes (`{ data, pagination }`) from existing `tool-providers.ts` where they already match the new interface (e.g. `ListToolsResult`).

- `packages/server/src/server/server-adapter/routes/tool-integrations.ts` — **new file**. Exports `TOOL_INTEGRATION_ROUTES = [...] as const`.

- `packages/server/src/server/server-adapter/routes/index.ts` — register `TOOL_INTEGRATION_ROUTES` alongside the existing `TOOL_PROVIDER_ROUTES`. Do not remove the legacy routes.

- `packages/server/src/server/schemas/index.ts` — re-export new schemas.

### Client SDK

- `client-sdks/client-js/src/resources/tool-integration.ts` — **new file**. `ToolIntegration` resource with: `listToolServices()`, `listTools(params?)`, `authorize(body)`, `getAuthStatus(authId)`, `connectionStatus(items)`, `health()`.
- `client-sdks/client-js/src/index.ts` — add `toolIntegrations(id)` accessor and `listToolIntegrations()` top-level. Existing `toolProvider(id)` / `listToolProviders()` stay (mark JSDoc `@deprecated`, point to `toolIntegrations`).
- `client-sdks/client-js/src/types.ts` — add new request/response types mirroring the server schemas.

### Tests

- `packages/server/src/server/handlers/tool-integrations.test.ts` — one block per route. Assert:
  - 200 happy path with mock `ToolIntegration` registered.
  - `UnknownIntegrationError → 404` for unknown providerId.
  - Connection-status with N items triggers exactly one upstream call (mock spy count).
  - `authorize` returns `{ url, authId }` verbatim.
  - Permission gating: routes have `requiresAuth: true`.
- `client-sdks/client-js/src/resources/tool-integration.test.ts` — typed-wrapper round-trip through a fake fetch.
- Legacy `/tool-providers/*` tests stay green untouched (compat guarantee).

### Explicitly NOT touched
- UI components.
- Agent hydration (Phase 4).
- Storage shape (Phase 1 / 1.5).
- Provider internals (Phase 3).
- Legacy `/tool-providers/*` routes, handlers, schemas, or SDK resource — they keep working through the Phase 2 compat shim.
- Prototype EE Composio routes — they do not exist on this branch.

## Acceptance truths

- [ ] `GET /api/tool-integrations` returns each registered integration's `{ id, displayName, capabilities }`.
- [ ] `GET /api/tool-integrations/composio/tool-services` returns only allowlisted services (filter applied by `BaseToolIntegration`).
- [ ] `GET /api/tool-integrations/composio/tools?toolService=gmail` returns wrapped `{ data, pagination }` with `hasMore`.
- [ ] `POST /api/tool-integrations/composio/authorize` returns `{ url, authId }`.
- [ ] `GET /api/tool-integrations/composio/auth-status/:authId` reflects ACTIVE → `completed`, INITIATED → `pending`, FAILED/EXPIRED → `failed`.
- [ ] `POST /api/tool-integrations/composio/connection-status` with N items triggers exactly one upstream Composio call per unique service.
- [ ] `GET /api/tool-integrations/unknown/health` returns 404 (translated from `UnknownIntegrationError`).
- [ ] Legacy `/api/tool-providers/*` routes still return 200 against the same registered integrations (compat shim in `MastraEditor.getToolProvider`).
- [ ] `client.toolIntegrations('composio').authorize({...})` compiles and round-trips.
- [ ] `client.toolProvider('composio').listToolkits()` still compiles (deprecated but working).

## Verification step

```
pnpm --filter ./packages/server build
pnpm --filter ./packages/server test tool-integrations
pnpm --filter ./packages/server test tool-providers   # legacy still green
pnpm --filter ./client-sdks/client-js build
pnpm --filter ./client-sdks/client-js test
```

All must pass. Manual smoke:

```
curl /api/tool-integrations
curl /api/tool-integrations/composio/tool-services
curl -X POST /api/tool-integrations/composio/connection-status \
  -d '{"items":[{"toolService":"gmail","connectionId":"ca_..."}]}'
```

## Handoff to next phase

- Canonical client surface: `client.toolIntegrations(id).*`. Phase 6 hooks consume it; legacy `client.toolProvider(id).*` stays available for any unmigrated callers.
- 404 translation pattern (`UnknownIntegrationError → 404`) lands here and is reused by future per-integration routes.
- Legacy `/tool-providers/*` and `client.toolProvider` are scheduled for removal in Phase 10b (next major), tracked alongside `ComposioToolProvider`.
