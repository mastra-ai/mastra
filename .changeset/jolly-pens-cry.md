---
'@mastra/core': minor
---

Added optional root output and error previews to advanced trace queries.

```ts
import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';

const request = parseTraceQueryRequest({
  timeRange,
  select: ['outputPreview', 'errorPreview'],
});
const result = await observabilityStore.queryTraces(planTraceQuery(request));
```
