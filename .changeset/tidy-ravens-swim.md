---
'@mastra/client-js': patch
---

Added `timeToFirstChunkMs` to the `queryTraces()` and `querySpans()` result types, and the `traceQueryTimeToFirstChunk` flag to `getObservabilityCapabilities()`.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.traceQueryTimeToFirstChunk) {
  const { spans } = await mastraClient.querySpans({
    timeRange,
    where: { op: 'gt', left: { path: 'timeToFirstChunkMs' }, right: { literal: 2000 } },
  });
}
```
