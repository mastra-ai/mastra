---
'@mastra/clickhouse': minor
---

Added thread rows with previews, trace counts, activity timestamps, filters and cursor pagination. Legacy thread identity queries remain supported.

Broad thread queries exceeding the retained-history limit return a resource-limit error. Narrower time ranges can still succeed.

```ts
import { planThreadRowsQuery } from '@mastra/core/storage';

await storage.queryThreads(
  planThreadRowsQuery({
    timeRange: { traces: { from, to } },
  }),
);
```
