# Phase 5 — Generic server routes (`/api/tool-providers/*`)

> Parent plan: [`../V1-PLAN.md`](../V1-PLAN.md)
> Spec: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
> Previous phase: [Phase 4 — Runtime fan-out](./phase-4-runtime-fanout.md)
> Next phase: [Phase 6 — UI tools panel + connection picker](./phase-6-ui-tools-panel.md)

## Goal

A provider-agnostic `/api/tool-providers/*` namespace exists end-to-end. Each handler delegates to the registered `ToolIntegration` via `editor.getToolProviderOrThrow(id)`. The old `/api/editor/builder/composio/*` family is deleted.

## Background

- **Why this phase is ordered here**: UI (Phase 6) calls these routes. Has no dependency on Phase 4's runtime — these are catalog + auth surface, not tool execution.
- Spec sections to re-read:
  - ARCHITECTURE §7 "Server routes"
  - ARCHITECTURE §13 "Adapter design principles" (no leaky interfaces)
- Inherited blockers / constraints:
  - Use `editor.getToolProviderOrThrow(id)` (NOT `getToolProvider` — that returns undefined under Phase 2's compat layer). The throw is caught and translated to 404 via centralized error middleware.
  - Server-side permission gating identical across providers.

## Scope

### Server
- `packages/server/src/server/handlers/tool-providers/` — new directory:
  - `list.ts` — `GET /api/tool-providers` (returns `{ id, name, capabilities }[]`).
  - `tool-services.ts` — `GET /api/tool-providers/:id/tool-services`.
  - `tools.ts` — `GET /api/tool-providers/:id/tools?toolService=...`.
  - `authorize.ts` — `POST /api/tool-providers/:id/authorize` body `{ toolService, connectionId? }`.
  - `auth-status.ts` — `GET /api/tool-providers/:id/auth-status/:authId`.
  - `connection-status.ts` — `POST /api/tool-providers/:id/connection-status` body `{ items: [...] }` (batch).
  - `health.ts` — `GET /api/tool-providers/:id/health`.
- `packages/server/src/server/routes.ts` — register the new namespace, drop the old `editor/builder/composio` namespace.

### Client SDK
- `client-sdks/client-js/src/resources/tool-providers.ts` — new. Typed wrappers per route.
- `client-sdks/client-js/src/index.ts` — export.

### Tests
- `packages/server/src/server/handlers/tool-providers/*.test.ts` — one test file per route. Assert permission gating, payload shapes, `UnknownProviderError → 404` translation.
- Cap passthrough: `GET /tool-providers` includes `capabilities` for each.
- `client-sdks/client-js/src/resources/tool-providers.test.ts` — typed-wrapper round-trip.

**Explicitly NOT touched**: UI components, agent hydration, storage shape, provider internals.

## Acceptance truths

- [ ] `GET /api/tool-providers` returns the configured providers with capabilities.
- [ ] `GET /api/tool-providers/composio/tool-services` returns only allowlisted services.
- [ ] `POST /api/tool-providers/composio/authorize` returns `{ url, authId }`.
- [ ] `POST /api/tool-providers/composio/connection-status` with N items returns a keyed status map and triggers exactly one upstream Composio call.
- [ ] `GET /api/tool-providers/unknown/health` returns 404 (translated from `UnknownProviderError`).
- [ ] Repo-wide search for `/editor/builder/composio` returns zero hits.
- [ ] `client.toolProviders.composio.authorize(...)` compiles and round-trips.

## Verification step

```
pnpm --filter ./packages/server build
pnpm --filter ./packages/server test tool-providers
pnpm --filter ./client-sdks/client-js build
pnpm --filter ./client-sdks/client-js test
```

All must pass. Plus a manual `curl` smoke:

```
curl /api/tool-providers/composio/tool-services
curl -X POST /api/tool-providers/composio/connection-status -d '{"items":[...]}'
```

## Handoff to next phase

- Canonical client surface: `client.toolProviders.<id>.*`. Phase 6 hooks consume it.
- Permission gating finalized at the server boundary — UI never needs to gate.
- 404 translation pattern (`UnknownProviderError → 404`) reusable for future routes.
