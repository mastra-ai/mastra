---
'@mastra/server': minor
---

Added support for selected trace output and error previews in observability routes.

```http
POST /api/observability/traces/query
Content-Type: application/json

{
  "timeRange": { "from": "2026-10-01T00:00:00Z", "to": "2026-10-02T00:00:00Z" },
  "select": ["outputPreview", "errorPreview"]
}
```
