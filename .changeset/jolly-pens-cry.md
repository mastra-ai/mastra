---
'@mastra/core': minor
---

Added optional root output and error previews to advanced trace queries. Unknown field names are left out instead of failing the request. Custom observability stores declare each field they serve as a `trace-query-select:<field>` feature, for example `trace-query-select:outputPreview`.

```ts
import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';

const request = parseTraceQueryRequest({
  timeRange,
  select: ['outputPreview', 'errorPreview'],
});
const result = await observabilityStore.queryTraces(planTraceQuery(request));
```
