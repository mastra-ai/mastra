---
'@mastra/core': minor
---

Added the trace aggregation registries that declare which trace fields can be grouped by, which fields `countDistinct` may target, and the v1 measures (`count`, `duration.*`, `errorCount`, `errorRate`) for the upcoming `aggregateTraces()` API.

```ts
import {
  getTraceAggregateDimensionDescriptors,
  isTraceAggregateDimension,
  parseTraceAggregateMeasure,
} from '@mastra/core/storage';

isTraceAggregateDimension('metadata.tenant'); // true — top-level metadata keys are groupable
isTraceAggregateDimension('metadata.customer.id'); // false — nested paths are not
isTraceAggregateDimension('traceId'); // false — identity fields are not dimensions

parseTraceAggregateMeasure('duration.p95'); // { type: 'canonical', measure: 'duration.p95', rule: { approximate: true, ... } }
parseTraceAggregateMeasure('countDistinct.traceId'); // { type: 'countDistinct', field: 'traceId' }

const dimensions = getTraceAggregateDimensionDescriptors(); // Decision 4 allowlist, in spec order
```
