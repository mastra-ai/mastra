---
'@mastra/dsql': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
---

Added configurable age-based pruning for observability spans in the MySQL, Microsoft SQL Server, and Amazon Aurora DSQL adapters. Configure the retention policy when constructing the adapter, then run bounded pruning from your scheduler or maintenance worker.

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

The Microsoft SQL Server and Amazon Aurora DSQL adapters use the same `retention` and `prune()` options.
