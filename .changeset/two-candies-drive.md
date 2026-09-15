---
'@mastra/core': minor
---

Added canonical trace-query field descriptors and bounded discovery contracts for queryable fields and values.

```ts
import {
  getTraceQueryCanonicalFieldDescriptors,
  parseGetTraceQueryValuesArgs,
  planTraceQueryValues,
} from '@mastra/core/storage';

const fields = getTraceQueryCanonicalFieldDescriptors('spans');
const values = await storage.getTraceQueryValues(
  planTraceQueryValues(
    parseGetTraceQueryValuesArgs({
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
      predicateScope: 'spans',
      path: 'model',
    }),
  ),
);
```
