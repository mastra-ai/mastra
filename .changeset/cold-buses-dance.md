---
'@mastra/server': minor
---

Deprecated thread grouping on the advanced trace-query endpoint. Grouped requests remain supported until the next major release; use the thread-query endpoint for new integrations.

Before:

```ts
await mastraClient.queryTraces({ timeRange, group: { by: ['threadId'] } });
```

After:

```ts
await mastraClient.queryTraceThreads({ traces: { timeRange } });
```
