---
'@mastra/client-js': minor
---

Added Client JS methods for bounded trace-query field and value discovery.

```ts
const fields = await mastraClient.getTraceQueryFields({
  timeRange,
  predicateScope: 'trace',
})

const values = await mastraClient.getTraceQueryValues({
  timeRange,
  predicateScope: 'spans',
  path: 'model',
})
```
