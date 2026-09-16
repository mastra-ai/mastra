---
'@mastra/core': minor
---

Added bounded trace-query discovery contracts and a stable resource-limit error for field and value suggestions.

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
