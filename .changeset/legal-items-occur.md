---
'@mastra/client-js': minor
---

Added Client JS methods for bounded trace-query field and value discovery. Requests can now override client-level retry and abort settings with the per-request `retries` and `signal` options. Retry counts must be non-negative safe integers, and aborted requests stop without retrying.

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
