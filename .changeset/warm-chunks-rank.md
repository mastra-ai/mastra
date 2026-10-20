---
'@mastra/client-js': patch
---

`queryTraces()` and `querySpans()` now accept `timeToFirstChunkMs` in `orderBy`, and `getObservabilityCapabilities()` returns the `traceQueryTimeToFirstChunkSort` flag.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.traceQueryTimeToFirstChunkSort) {
  const { spans } = await mastraClient.querySpans({
    timeRange,
    orderBy: [{ field: 'timeToFirstChunkMs', direction: 'desc' }],
  });
}
```
