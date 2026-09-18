---
'@mastra/core': minor
---

Deprecated thread grouping in `queryTraces()`. Grouping remains functional until the next major release; use `queryTraceThreads()` for new code.

Before:

```ts
await mastraClient.queryTraces({ timeRange, group: { by: ['threadId'] } });
```

After:

```ts
await mastraClient.queryTraceThreads({ traces: { timeRange } });
```
