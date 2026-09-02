---
'@mastra/server': minor
---

Added an authenticated endpoint for deleting traces and their linked observability signals.

```http
POST /api/observability/traces/delete

{ "traceIds": ["trace-1"] }
```
