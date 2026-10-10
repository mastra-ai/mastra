---
'@mastra/client-js': minor
---

Added root output and error preview selection to `queryTraces()`. Check which fields the server supports before you request them:

```ts
const { capabilities } = await mastraClient.getObservabilityCapabilities();
const select = capabilities?.traceQuerySelect ?? [];

const result = await mastraClient.queryTraces({
  timeRange,
  ...(select.length ? { select } : {}),
});

console.log(result.traces[0]?.outputPreview);
```
