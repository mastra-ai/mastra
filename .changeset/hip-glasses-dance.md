---
'@mastra/core': minor
---

Added the observability storage contract for querying thread identities with cross-trace predicates.

```ts
await observabilityStore.queryThreads({
  result: 'threads',
  traces: {
    timeRange: { from, to },
    where: eligibleTracePredicate,
  },
  where: threadPredicate,
  orderBy: { field: 'threadId', direction: 'asc' },
  limit: 100,
  binding,
});
```
