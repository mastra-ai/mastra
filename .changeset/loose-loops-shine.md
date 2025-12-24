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

Add CompositeStorage for mixing storage backends

`CompositeStorage` combines storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

```typescript
import { CompositeStorage } from '@mastra/core/storage';
import { PostgresStore } from '@mastra/pg';
import { LibSQLStore } from '@mastra/libsql';

const storage = new CompositeStorage({
  id: 'composite',
  default: new PostgresStore({ id: 'pg', connectionString: process.env.DATABASE_URL }),
  domains: {
    memory: new LibSQLStore({ id: 'libsql', url: 'file:./local.db' }).stores?.memory,
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
