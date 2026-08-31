---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `GET /api/observability/traces/groups` endpoint and the matching `client.listTraceGroups()` method to group traces by a span context key (like `threadId`) with per-group trace counts.

```ts
const { groups, pagination } = await client.listTraceGroups({ groupBy: 'threadId' });
```
