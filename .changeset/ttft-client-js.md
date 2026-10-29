---
'@mastra/client-js': patch
---

`queryTraces()`, `querySpans()` and `queryTraceThreads()` results now include `timeToFirstTokenMs` when the store supports it, and `queryTraces()` and `querySpans()` accept it in `orderBy`. `getObservabilityCapabilities()` returns the `traceQueryTimeToFirstToken` and `traceQueryTimeToFirstTokenSort` flags.

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();

if (capabilities.traceQuery && capabilities.traceQueryTimeToFirstTokenSort) {
  const { traces } = await mastraClient.queryTraces({
    timeRange,
    orderBy: [{ field: 'timeToFirstTokenMs', direction: 'desc' }],
  });
}
```
