---
'@mastra/client-js': minor
---

Deprecated grouped results from `queryTraces()`. Existing grouped queries continue to work until the next major release; use `queryThreads()` for new code.

Before:

```ts
await mastraClient.queryTraces({ timeRange, group: { by: ['threadId'] } });
```

After:

```ts
await mastraClient.queryThreads({ traces: { timeRange } });
```
