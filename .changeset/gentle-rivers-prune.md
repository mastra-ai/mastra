---
'@mastra/mysql': minor
---

Added configurable age-based pruning for observability spans. Requires `@mastra/core` 1.68 or newer.

```typescript
import { MySQLStore } from '@mastra/mysql'

const storage = new MySQLStore({
  connectionString: process.env.DATABASE_URL!,
  retention: {
    observability: {
      spans: { maxAge: '30d', batchSize: 1_000 },
    },
  },
})

await storage.prune({ maxBatches: 10, maxRows: 10_000, pauseMs: 25 })
```
