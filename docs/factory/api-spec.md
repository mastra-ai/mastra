# API Specification — Mastra Software Factory

All routes are defined as typed contracts in `src/routes/contracts.ts` (`FACTORY_ROUTE_CONTRACTS`) — method, path, path/query/body Zod schemas, and response schema — and assembled into `ApiRoute`s in `src/routes/surface.ts`. Every path is prefixed `/web/factory` and authenticated through the shared `RouteAuth` seam (`src/auth.ts`); org scope is derived from the authenticated caller, never taken from client input.

## Projects

| Contract | Method & Path | Notes |
|---|---|---|
| `projectList` | `GET /web/factory/projects` | List projects for the caller's org |
| `projectCreate` | `POST /web/factory/projects` | Body: `name`, `description?` |
| `projectGet` | `GET /web/factory/projects/:id` | |
| `projectUpdate` | `PATCH /web/factory/projects/:id` | Body: any of `name`, `description`, `defaultModelId`, `slackWorkItemsEnabled`, `autoRunEnabled`, `autoApprovePlans` (at least one required) |
| `projectDelete` | `DELETE /web/factory/projects/:id` | |
| `metricsGet` | `GET /web/factory/projects/:id/metrics` | Query-bounded metrics window |
| `healthThresholdsGet` | `GET /web/factory/projects/:id/health/thresholds` | Queue-health threshold array |

## Boards

| Contract | Method & Path | Notes |
|---|---|---|
| `boardCatalog` | `GET /web/factory/projects/:id/boards` | Returns installed boards: `id`, `title`, `initialPhase`, and each phase's `id`, `title`, `kind`, `role?`, and outgoing `transitions` |

## Work items

| Contract | Method & Path | Notes |
|---|---|---|
| `workItemList` | `GET /web/factory/projects/:id/work-items` | Returns `workItems`, plus `runningSessionIds`/`parkedSessionIds` for live status badges |
| `workItemCreate` | `POST /web/factory/projects/:id/work-items` | Creates a manual item in Intake |
| `workItemUpdate` | `PATCH /web/factory/work-items/:id` | Non-stage fields only — stage changes go through `workItemTransition` |
| `workItemDelete` | `DELETE /web/factory/work-items/:id` | |
| `workItemTransition` | `POST /web/factory/projects/:id/work-items/:workItemId/transition` | Body includes the expected `revision` — rejected with a conflict if stale (optimistic concurrency) |
| `workItemStart` | `POST /web/factory/projects/:id/runs/start` | Explicitly starts a run on a work item (bypasses waiting for a rule to fire) |

## Decisions (deferred/parked rule outcomes)

| Contract | Method & Path | Notes |
|---|---|---|
| `decisionList` | `GET /web/factory/projects/:id/decisions` | Cursor-paginated |
| `decisionApprove` | `POST /web/factory/projects/:id/decisions/:decisionId/approve` | |
| `decisionDismiss` | `POST /web/factory/projects/:id/decisions/:decisionId/dismiss` | |
| `decisionRetry` | `POST /web/factory/projects/:id/decisions/:decisionId/retry` | Only valid for a retryable failure code |

## Attention inbox

| Contract | Method & Path | Notes |
|---|---|---|
| `attentionList` | `GET /web/factory/projects/:id/attention` | Returns `items`, per-kind `open`/`unread`/`latest` counts, `hasMore`/`nextCursor` |
| `attentionReadAll` | `POST /web/factory/projects/:id/attention/read-all` | Query `before` cursor |
| `attentionRead` | `POST /web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/read` | Path validates `sourceId` shape per `kind` (UUID for most kinds, a restricted charset for `supervisor-finding`) |
| `attentionArchive` | `POST /web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/archive` | Same path shape as `attentionRead` |
| `attentionRestore` | `POST /web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/restore` | Same path shape as `attentionRead` |

## Supervisor / diagnostics

| Contract | Method & Path | Notes |
|---|---|---|
| `supervisorSession` | `POST /web/factory/projects/:id/supervisor/session` | Returns the deterministic supervisor session address: `sessionId`, `threadId`, `factoryProjectId` |
| `supervisorHealth` | `GET /web/factory/projects/:id/supervisor/health` | Runs the deterministic supervisor health check; returns `checkedAt`, `findings[]`, `counts` |

## Documents

| Contract | Method & Path | Notes |
|---|---|---|
| `documentList` | `GET /web/factory/projects/:id/documents` | Returns `docsRoot`, `manifestPath`, the full 14-kind `catalog` (kind/group/label/defaultPath/purpose), synced `documents[]` (bodies omitted), and `sync` state (`sourceRef`, `sourceSha`, `manifestStatus`, `syncedAt`) or `null` if never synced |
| `documentGet` | `GET /web/factory/projects/:id/documents/:kind` | Returns one document including its markdown `content` (`null` if missing) |
| `documentRefresh` | `POST /web/factory/projects/:id/documents/refresh` | Re-syncs from a live sandbox checkout; returns `outcome: 'synced' \| 'unchanged'` |

## Conventions

- **Path params** are validated with a shared `uuidSchema` (`^[0-9a-fA-F]{8}-...$`) for project/work-item/decision ids.
- **Optimistic concurrency**: work-item transitions and updates carry a `revision` the server checks against the stored row; a mismatch is rejected rather than silently overwritten.
- **Pagination**: list endpoints that can grow unbounded (decisions, attention) use cursor pagination (`nextCursor`) rather than offset.
- **Responses are typed by the same Zod schema on both sides** — each contract declares a `responseSchema` (`contracts.ts`) that is asserted in contract tests and used to derive request/response types for `surface.ts`, `factory-ui`, and `sdk` consumers; it is not asserted against outgoing payloads at runtime.
- **Integration-specific routes** (GitHub/Linear/Slack/WorkOS webhooks and OAuth callbacks) are not part of `FACTORY_ROUTE_CONTRACTS` — each `FactoryIntegration` contributes its own `ApiRoute[]` via `IntegrationContext`, mounted alongside the core contract routes.
