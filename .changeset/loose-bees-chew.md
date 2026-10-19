---
'@mastra/pg': minor
---

Added thread rows with previews, trace counts, activity timestamps, filters and cursor pagination. Legacy thread identity queries remain supported.

```ts
import { planThreadRowsQuery } from '@mastra/core/storage';

await storage.queryThreads(
  planThreadRowsQuery({
    timeRange: { traces: { from, to } },
  }),
);
```
