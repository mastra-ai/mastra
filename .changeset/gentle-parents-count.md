---
'@mastra/server': minor
---

Added `GET /api/workflows/run-counts` — per-workflow counts of running and suspended (awaiting resume) runs in one request, keyed by the workflow registry key. Counts respect the reserved request-context resource id the runs endpoints already enforce, are filtered per user when FGA is configured, and may be served from a short server-side cache otherwise.

```json
// GET /api/workflows/run-counts
{
  "cityWorkflow": { "running": 2, "suspended": 1 },
  "reportWorkflow": { "running": 0, "suspended": 0 }
}
```
