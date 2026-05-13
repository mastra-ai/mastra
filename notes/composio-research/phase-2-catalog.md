# Phase 2 — Gated Catalog View (allowlist filter over existing `/tool-providers` routes)

> Parent RFC: [`../composio-research.md`](../composio-research.md) — see "DISCOVERY (rev 3)".
> Previous phase: [Phase 1 — Agent Builder Composio Gating Config](./phase-1-config.md)
> Next phase: [Phase 3 — Storage + Connect Link Lifecycle](./phase-3-connections.md)

> **Rev 3 delta**: `GET /tool-providers/:id/toolkits|/tools|/tools/:slug/schema` already exist in `packages/server/src/server/handlers/tool-providers.ts` (ungated). Phase 2 is now: expose a **gated view** sitting under `/editor/builder/composio/*` that applies `registries.composio.allowedToolkits` / `allowedTools` filtering on top. Do **not** modify or replace the existing ungated routes — they still serve workspace-wide integration UIs.

## Goal

Expose two read-only server routes that list **gated** Composio toolkits and tools, filtered through the Agent Builder allowlist. Reuse the existing `ComposioToolProvider` via `editor.getToolProvider(registry.providerId)` — do not call `@composio/core` directly. No UI, no DB.

## Background

- **Why this phase is ordered here**: catalog is the simplest reading surface — no auth flow, no state. Establishes the routing pattern and allowlist filter that Phase 3 (connection routes) and Phase 4 (UI) both reuse.
- Parent RFC sections to re-read:
  - "SESSIONS → Catalog gating (no session needed)"
  - "SESSIONS → When sessions ARE required"
  - "CONFIG MODEL (v1 — in code, under `editor.builder`)" — for `allowedToolkits` / `allowedTools` semantics.
- Inherited blockers: registry config from Phase 1; routes are 404 when Composio not configured.

## Scope

### Server
- `packages/server/src/server/handlers/editor-builder-composio.ts` — new handler module.
  - `GET /editor/builder/composio/toolkits` — list filtered toolkits.
  - `GET /editor/builder/composio/toolkits/:slug/tools` — list filtered tools for a toolkit.
- `packages/server/src/server/handlers/editor-builder.ts` — register new routes under the existing editor-builder router; reuse `requireBuilderFeature` gate (404 if Composio not configured).
- `packages/server/src/server/types/permissions.ts` (or equivalent) — add `composio:read` permission tuple. Grant alongside `stored-agents:read`.

### Editor module (catalog helpers)
- `packages/editor/src/ee/integrations/composio/catalog.ts` — `listGatedToolkits(provider, registry)`, `listGatedTools(provider, registry, toolkitSlug)`. **Reuse `provider.listToolkits()` / `provider.listTools()` from the existing `ComposioToolProvider`** — do not import `@composio/core`.
- `packages/editor/src/ee/integrations/composio/index.ts` — re-export catalog helpers.

### Playground / Editor (clients)
- none — Phase 2 ships API only.

### Tests
- `packages/editor/src/ee/integrations/composio/catalog.test.ts` — unit tests with a **stub `ToolProvider`** (not mocked `@composio/core`): filter respects `allowedToolkits`, filter respects `allowedTools` per toolkit, missing `allowedTools[toolkit]` returns full toolkit's tools, empty `allowedTools[toolkit] = []` returns zero tools.
- `packages/server/src/server/handlers/editor-builder-composio.test.ts` — integration tests: route returns 404 when Composio disabled, route returns 403 without permission, route returns filtered catalog with permission, route rejects toolkit slug outside allowlist.

**Explicitly NOT touched**: DB schema, Connect Link, sessions, runtime tool resolution, UI components, the existing ungated `/tool-providers/:id/*` routes.

## Acceptance truths

- [ ] `GET /editor/builder/composio/toolkits` returns only toolkits whose slug is in `registries.composio.allowedToolkits`.
- [ ] `GET /editor/builder/composio/toolkits/:slug/tools` returns 404 if `slug` not in `allowedToolkits`.
- [ ] When `allowedTools[slug]` is set, response is filtered to that list; when missing, all tools in the toolkit are returned; when `[]`, zero tools are returned.
- [ ] Routes 404 (not 401/403) when `registries.composio` is absent or disabled — does not leak feature existence.
- [ ] Routes 403 for authenticated users lacking the read permission (tuple finalized in this phase).
- [ ] Catalog helpers only call `ToolProvider` methods (`listToolkits`, `listTools`) — they do **not** import `@composio/core`.
- [ ] Catalog helper functions are deterministic against a stubbed `ToolProvider`.
- [ ] OpenAPI / route registration includes both new endpoints.
- [ ] The existing ungated `/tool-providers/:id/*` routes are untouched and still serve workspace-wide integration UIs.

## Verification step

```
pnpm --filter @mastra/editor build && pnpm --filter @mastra/editor test -- composio
pnpm --filter @mastra/server build && pnpm --filter @mastra/server test -- editor-builder-composio
pnpm --filter @mastra/server tsc --noEmit
curl -H "Cookie: ${SESSION}" http://localhost:4111/editor/builder/composio/toolkits | jq
curl -H "Cookie: ${SESSION}" http://localhost:4111/editor/builder/composio/toolkits/gmail/tools | jq
```

All test runs must pass. Manual curl returns a filtered list matching the configured allowlist; toolkits outside the allowlist do not appear.

## Handoff to next phase

- Canonical catalog helpers: `listToolkits()`, `listTools(slug)` in `packages/editor/src/ee/integrations/composio/catalog.ts`. Phase 3 reuses these to validate `toolkit` arguments on connection-initiate requests.
- Permission tuple `composio:read` now exists. Phase 3 will add `composio:write` for connection management.
- Server route file `editor-builder-composio.ts` is the home for all subsequent Composio routes — Phase 3 appends here.
- Follow-up backlog: catalog response caching (Composio rate limits + perceived latency) — defer to post-v1.
