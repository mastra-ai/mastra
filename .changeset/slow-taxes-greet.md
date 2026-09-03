---
'@mastra/server': minor
---

Added an authenticated endpoint for deleting up to 1,000 traces and their linked observability signals per request.

```http
POST /api/observability/traces/delete

{ "traceIds": ["trace-1"] }
```
