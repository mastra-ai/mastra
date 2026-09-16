---
'@mastra/core': minor
---

Added a stable resource-limit error for bounded trace-query field and value discovery.

```ts
import { TraceQueryResourceLimitError, planTraceQueryValues } from '@mastra/core/storage'

const plan = planTraceQueryValues({
  timeRange,
  predicateScope: 'spans',
  path: 'model',
  search: 'claude',
  limit: 25,
})

try {
  await observability.getTraceQueryValues(plan)
} catch (error) {
  if (error instanceof TraceQueryResourceLimitError) {
    console.error(error.code)
  }
}
```
