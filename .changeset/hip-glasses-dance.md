---
'@mastra/core': minor
---

Added the observability storage contract for querying thread identities with cross-trace predicates.

```ts
const input = parseQueryThreadsInput({
  traces: {
    timeRange: { from, to },
    where: eligibleTracePredicate,
  },
  where: threadPredicate,
});

const plan = planThreadQuery(input);
const result = await observabilityStore.queryThreads(plan);
```
