---
'@mastra/clickhouse': minor
---

Added ClickHouse support for querying thread identities with cross-trace predicates. The store now advertises the `thread-query` capability.

```ts
const plan = planThreadQuery(parseQueryThreadsInput(input));
const result = await observabilityStore.queryThreads(plan);
```
