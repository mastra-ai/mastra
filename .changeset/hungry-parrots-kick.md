---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/mssql': minor
'@mastra/mongodb': minor
'@mastra/libsql': minor
---

Added `status` field to `listTraces` response. The status field indicates the trace state: `success` (completed without error), `error` (has error), or `running` (still in progress). This makes it easier to filter and display traces by their current state without having to derive it from the `error` and `endedAt` fields.

**Example:**

```typescript
const { spans } = await storage.listTraces({ filters: {}, pagination: { page: 0, perPage: 10 } });

// Each span now includes a status field
spans.forEach(span => {
  console.log(span.traceId, span.status); // 'success' | 'error' | 'running'
});

// Filter by status
const runningTraces = await storage.listTraces({
  filters: { status: 'running' },
  pagination: { page: 0, perPage: 10 }
});
```
