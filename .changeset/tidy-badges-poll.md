---
'@mastra/client-js': minor
---

Added `listWorkflowRunCounts()` — fetches per-workflow counts of running and suspended runs from the new aggregated server endpoint in a single request.

```typescript
const runCounts = await mastraClient.listWorkflowRunCounts();
// { "cityWorkflow": { running: 2, suspended: 1 }, ... }
```

Servers that predate the endpoint respond with `404 Not Found`.
