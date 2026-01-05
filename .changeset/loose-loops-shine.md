---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Add storage composition to MastraStorage

`MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

```typescript
import { MastraStorage } from '@mastra/core/storage';
import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
import { MemoryLibSQL } from '@mastra/libsql';

// Compose domains from different stores
const storage = new MastraStorage({
  id: 'composite',
  domains: {
    memory: new MemoryLibSQL({ url: 'file:./local.db' }),
    workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
    scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
  },
});
```

**Breaking changes:**

- `storage.supports` property no longer exists
- `StorageSupports` type is no longer exported from `@mastra/core/storage`

All stores now support the same features. For domain availability, use `getStore()`:

```typescript
const store = await storage.getStore('memory');
if (store) {
  // domain is available
}
```
