---
'@mastra/core': minor
'@mastra/pg': minor
---

Added `disableInit` option to `MastraVector` base class so vector stores can opt out of running DDL at app startup. This matches the existing `disableInit` behavior on storage adapters and supports deployments that run schema/index migrations with a privileged role while the application uses a least-privilege role.

**Usage**

```typescript
const vector = new PgVector({
  id: 'vectors',
  connectionString: process.env.DATABASE_URL,
  disableInit: true,
});
```

The `MASTRA_DISABLE_STORAGE_INIT` environment variable also gates vector init, so a single flag can disable both storage and vector DDL.
