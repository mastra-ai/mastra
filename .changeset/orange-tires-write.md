---
'@mastra/core': minor
---

Added helpers to check which trace fields you can group by and which measures you can request for the upcoming `aggregateTraces()` API.

- Group by trace fields such as `status` or `userId`, or by top-level `metadata.<key>` paths.
- Supported measures: `count`, `duration.avg`/`min`/`max`/`p50`/`p90`/`p95`/`p99`, `errorCount`, `errorRate`, and `countDistinct.<field>`. Percentile values can be approximate.

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

const dimensions = getTraceAggregateDimensionDescriptors(); // all groupable trace fields
```
