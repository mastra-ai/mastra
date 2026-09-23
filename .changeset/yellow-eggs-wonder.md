---
'@mastra/core': patch
---

Added public Zod request and response schemas and types for the upcoming `aggregateTraces()` observability operation: `traceAggregateRequestSchema`, `traceAggregateResponseSchema`, and `parseTraceAggregateRequest()`. Selection (`timeRange`, `where`) reuses the existing trace-query schemas, so aggregate and list queries validate the same population. No runtime operation ships yet; the storage method and HTTP route follow in later releases.

```ts
import { parseTraceAggregateRequest } from '@mastra/core/storage';

const request = parseTraceAggregateRequest({
  timeRange: { from: '2026-09-01T00:00:00Z', to: '2026-09-08T00:00:00Z' },
  groupBy: ['entityName'],
  measures: ['count', 'duration.p95'],
});
// request.limit === 100, request.orderBy === { field: 'count', direction: 'desc' }
```
