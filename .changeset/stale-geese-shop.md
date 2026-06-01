---
'@mastra/core': minor
'@mastra/pg': minor
---

Added the `disableInit` option to the `MastraVector` base class. When set to `true`, vector stores skip creating schemas, extensions, tables, and indexes at application startup. This matches the existing `disableInit` behavior on storage adapters and is useful for deployments where schemas and indexes are created ahead of time by a privileged database role, while the application runs with a least-privilege role.

**Usage**

```typescript
const vector = new PgVector({
  id: 'vectors',
  connectionString: process.env.DATABASE_URL,
  disableInit: true,
});
```

The `MASTRA_DISABLE_STORAGE_INIT` environment variable also disables vector init, so a single flag prevents both storage and vector stores from creating schemas, tables, or indexes at startup.
