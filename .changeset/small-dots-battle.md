---
'@mastra/core': minor
---

Removed grouped results from the advanced trace-query contract. Queries now return trace records only.

**Before**

```ts
const result = await queryTraces({ timeRange, group: { by: ['threadId'] } });
```

**After**

```ts
const result = await queryTraces({ timeRange });
```
