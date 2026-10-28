---
'@mastra/client-js': patch
---

`queryTraces()`, `querySpans()` and `queryThreads()` results now include `timeToFirstTokenMs` when the store supports it, and `queryTraces()` and `querySpans()` accept it in `orderBy`. `getObservabilityCapabilities()` returns the `traceQueryTimeToFirstToken` and `traceQueryTimeToFirstTokenSort` flags.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.traceQueryTimeToFirstTokenSort) {
  const { spans } = await mastraClient.querySpans({
    timeRange,
    orderBy: [{ field: 'timeToFirstTokenMs', direction: 'desc' }],
  });
}
```
