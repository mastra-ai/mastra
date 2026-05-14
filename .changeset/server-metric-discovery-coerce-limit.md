---
'@mastra/core': patch
'@mastra/server': patch
---

`GET /api/observability/discovery/metric-names` and `GET /api/observability/discovery/metric-label-values` now accept `limit` as a URL query parameter without pre-parsing. Previously, passing `?limit=10` was rejected as a validation error; callers can now use these endpoints directly from HTTP clients, consistent with other query endpoints (e.g. pagination).
