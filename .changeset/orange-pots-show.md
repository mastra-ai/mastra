---
'@mastra/client-js': minor
---

Added root output and error preview selection to `queryTraces()`.

```ts
const result = await mastraClient.queryTraces({
  timeRange,
  select: ['outputPreview', 'errorPreview'],
});

console.log(result.traces[0]?.outputPreview);
```
