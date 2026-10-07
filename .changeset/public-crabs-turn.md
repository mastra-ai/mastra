---
'@mastra/server': minor
---

Added selected trace output and error previews to observability routes. `GET /api/system/packages` now lists the supported fields in `observabilityStorageCapabilities.traceQuerySelect`. Fields the store doesn't support are left out of each row instead of failing the request.

```http
POST /api/observability/traces/query
Content-Type: application/json

{
  "timeRange": { "from": "2026-10-01T00:00:00Z", "to": "2026-10-02T00:00:00Z" },
  "select": ["outputPreview", "errorPreview"]
}
```

Send `select` only when `traceQuerySelect` lists fields. Older servers reject the key, and an older `@mastra/server` running with a newer `@mastra/core` accepts it but returns no previews.
