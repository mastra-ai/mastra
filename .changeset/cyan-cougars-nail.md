---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `listTraceGroups` to observability storage: group traces by a span context key (like `threadId` or `userId`) and get per-group trace counts, error counts, and the most recent trace. Groups respect the same filters as `listTraces`, so you can expand a group by listing traces filtered on the group's value.

```ts
const { groups } = await storage.getStore('observability').listTraceGroups({
  groupBy: 'threadId',
  filters: { entityType: 'agent' },
});
// groups: [{ value: 'thread-1', count: 12, errorCount: 1, latestStartedAt, latestTraceId }, ...]
```
