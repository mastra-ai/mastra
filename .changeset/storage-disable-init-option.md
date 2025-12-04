---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/upstash': minor
'@mastra/mssql': minor
'@mastra/mongodb': minor
'@mastra/dynamodb': minor
'@mastra/convex': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/clickhouse': minor
'@mastra/lance': minor
---

Add `disableInit` option to all storage adapters

Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

```typescript
// CI/CD script - run migrations
const storage = new PostgresStore({ 
  connectionString: DATABASE_URL,
  id: 'pg-storage',
});
await storage.init();

// Runtime - skip auto-init
const storage = new PostgresStore({ 
  connectionString: DATABASE_URL,
  id: 'pg-storage',
  disableInit: true,
});
```


