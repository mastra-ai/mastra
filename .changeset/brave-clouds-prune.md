---
'@mastra/dsql': minor
---

Added configurable age-based pruning for observability spans. Requires `@mastra/core` 1.68 or newer.

```typescript
import { DSQLStore } from '@mastra/dsql'

const storage = new DSQLStore({
  id: 'dsql-storage',
  host: 'abc123.dsql.us-east-1.on.aws',
  retention: {
    observability: {
      spans: { maxAge: '30d', batchSize: 1_000 },
    },
  },
})

await storage.prune({ maxBatches: 10, maxRows: 10_000, pauseMs: 25 })
```
