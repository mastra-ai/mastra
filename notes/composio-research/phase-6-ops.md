# Phase 6 — Observability + Admin Polish (`/infrastructure`, error UX, docs)

> Parent RFC: [`../composio-research.md`](../composio-research.md)
> Previous phase: [Phase 5 — Runtime Tool Execution](./phase-5-runtime.md)
> Next phase: — (vNext backlog)

> **Rev 2 delta** (after Phases 1–3 shipped):
>
> - **No DB table for connections.** Phase 3 confirmed Composio is the source of truth. `activeConnections` / `pendingConnections` come from `composio.connectedAccounts.list({ userIds, statuses })`, NOT from a local DB count.
> - **No `label?` field.** Connection labels are deferred to vNext (per parent RFC appendix). Phase 6 ships without them.
> - **Helpers live in core.** Health + error-mapping helpers go under `packages/core/src/agent-builder/ee/` for consistency with Phase 3 (`composio-connections.ts`, `composio-user-id.ts`, `composio-catalog.ts`). The editor module gains no new files for Phase 6.
> - **Docs path** is `docs/src/content/en/docs/editor/composio.mdx` (sibling of `tools.mdx`) plus a reference page at `docs/src/content/en/reference/editor/`. The "agent-builder/" docs root does not exist.
> - **No cumulative changeset.** Per-phase changesets already shipped.

## Goal

Production readiness. Admin can see Composio status (configured, # connections, last error) via the infrastructure endpoint. Connection failures (revoked, network) surface as actionable messages, not stack traces. Docs ship.

## Background

- **Why this phase is ordered here**: feature is functionally complete after Phase 5; this phase makes it operable. Independent of Phases 1–5 functionality — does not gate the v1 release if cut, but strongly recommended.
- Parent RFC sections to re-read:
  - "RISKS" — single-point-of-failure, API churn.
  - "vNext — CONNECTION-LEVEL RBAC → v1 plan" — `label?` field is allowed to land here (still nullable, optional UI).
- Inherited blockers: depends on runtime (`ComposioToolProvider.resolveTools`) being instrumented at one boundary, and on `ComposioConnectionRevokedError` from Phase 5 being available to map.

## Scope

### Server
- `packages/server/src/server/handlers/editor-builder.ts` — extend `GET /editor/builder/infrastructure` response:
  - `composio: { configured, allowedToolkits, activeConnections, pendingConnections, lastError?, lastErrorAt? }`.
- `packages/core/src/agent-builder/ee/composio-health.ts` — `getComposioHealth({ registry, client })` calls `composio.connectedAccounts.list({ userIds: [registry.platformUserId], statuses: ['ACTIVE'] })` and `{ statuses: ['INITIATED'] }` to compute counts, and reads the last-error from a small in-memory error buffer (also defined here). Tolerates Composio API failure by surfacing `lastError` with the failure rather than throwing.
- Wire a tiny error buffer (`recordComposioError(err)`) into `ComposioToolProvider.resolveTools` and the connection helpers (`initiateConnection`, `revokeConnection`, `getConnection`, `listConnections`). Bounded ring buffer, last N errors. The buffer is module-level state in `composio-health.ts`.

### Error UX
- `packages/core/src/agent-builder/ee/composio-errors.ts` (extends or sits next to Phase 5's `ComposioConnectionRevokedError`) — map common Composio SDK error shapes to user-facing messages:
  - Revoked / expired account → "Connection broken, please reconnect <toolkit>".
  - Rate limit → "Service temporarily unavailable, try again shortly".
  - Tool not allowed by allowlist → "This tool is not enabled for this workspace".
- `packages/playground-ui/src/domains/agent-builder/integrations/composio/connection-status-badge.tsx` — render `ACTIVE | PENDING | REVOKED | ERROR` on account picker rows. Status comes from Composio's `connectedAccount.status` field on each `GET /connections` row.
- When runtime hits a revoked connection, the chat surface shows the mapped error inline (no stack trace).

### Docs
- `docs/src/content/en/docs/editor/composio.mdx` (sibling of `tools.mdx`) — admin config walkthrough, author workflow screenshots, troubleshooting.
- Update `docs/src/content/en/reference/editor/tool-provider.mdx` and the editor nav (`_meta.ts`) to surface the new page.
- Follow `mastra-docs` skill: run `prettier`, `remark`, and (if available) `vale`.

### Tests
- `packages/core/src/agent-builder/ee/composio-health.test.ts` — buffer rolls (bounded), counts query Composio (mocked client), missing-config returns `configured: false`, Composio API failure surfaces in `lastError` rather than throwing.
- `packages/core/src/agent-builder/ee/composio-errors.test.ts` — every error class maps to a stable user-facing message.
- E2E: simulate a revoked connection (mock Composio response with status `REVOKED`), trigger a tool call, assert the chat surface renders the mapped error.

**Explicitly NOT touched**: vNext per-user / per-author modes; connection ACL enforcement; toolkit role gating (config slot reserved only).

## Acceptance truths

- [ ] `GET /editor/builder/infrastructure` returns a `composio` object when Composio is configured; omits or sets `configured: false` otherwise.
- [ ] Counts for `activeConnections` and `pendingConnections` come from `composio.connectedAccounts.list` (Composio is the source of truth — no DB table).
- [ ] `lastError` is present after a forced runtime failure; cleared / aged out per buffer policy.
- [ ] Revoked-connection runtime path produces a stable user-facing string, not a stack trace.
- [ ] Connection rows render a status badge in the account picker matching Composio's `connectedAccount.status`.
- [ ] `docs/src/content/en/docs/editor/composio.mdx` exists; lint/build passes; nav (`_meta.ts`) includes it.
- [ ] Per-phase changeset shipped (no cumulative file).
- [ ] No new error-handling code in unrelated packages — error mapping is isolated to `@mastra/core/agent-builder/ee/composio-errors.ts`.

## Verification step

```
pnpm --filter @mastra/editor build && pnpm --filter @mastra/editor test -- composio
pnpm --filter @mastra/server build && pnpm --filter @mastra/server test -- editor-builder
pnpm --filter @mastra/playground-ui build && pnpm --filter @mastra/playground-ui test
pnpm --filter @mastra/playground test:e2e -- composio-ops
pnpm --filter docs build
```

All must pass. Manual: revoke a Composio connection in their dashboard, run the dependent agent → mapped error appears in chat and a banner in builder shows the revoked status.

## Handoff to next phase

- vNext backlog re-anchored in this phase's PR description:
  - Per-agent `composioAuthMode` (extend `resolveComposioUserId` body — single function).
  - Connection-level RBAC enforcement on `listConnections` and save paths.
  - Toolkit role gating in registry config.
  - Per-author mode + `authorId` connection ownership.
  - MCP-server integration path (`session.mcp.url`) as alternative to native tool registration.
  - Composio triggers / webhooks.
- Health buffer pattern (ring + `recordError`) is now canonical at `packages/core/src/agent-builder/ee/composio-health.ts` — reuse for any future integration.
- Docs page is the canonical entry for users. Future integrations should add sibling pages under `docs/src/content/en/docs/editor/`.
