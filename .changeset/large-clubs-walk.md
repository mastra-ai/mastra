---
'@mastra/server': minor
---

Added an authenticated thread-query endpoint with capability checks and structured query errors.

```http
POST /observability/threads/query
Content-Type: application/json

{
  "traces": {
    "timeRange": {
      "from": "2026-08-01T00:00:00Z",
      "to": "2026-09-01T00:00:00Z"
    }
  }
}
```

The endpoint accepts eligible trace and cross-trace predicates and returns thread identities with cursor pagination.
