---
'@mastra/core': patch
'@mastra/server': patch
---

Fix `GET /api/observability/discovery/metric-names` and `GET /api/observability/discovery/metric-label-values` rejecting valid requests with `limit` set. The query schema used `z.number()` for `limit`, so callers (whose values arrive as strings via URL query params) hit `Invalid input: expected number, received string`. Switched the discovery arg schemas to `z.coerce.number()` so HTTP callers no longer need to pre-parse numeric values, matching the pattern used by other query schemas (e.g. `paginationArgsSchema`).
