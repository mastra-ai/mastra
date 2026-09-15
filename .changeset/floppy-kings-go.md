---
'@mastra/client-js': minor
---

Removed thread-group responses from `queryTraces()`. The client now accepts trace-only queries and returns trace records.

**Before**

```ts
const result = await client.queryTraces({ timeRange, group: { by: ['threadId'] } });
```

**After**

```ts
const result = await client.queryTraces({ timeRange });
```
