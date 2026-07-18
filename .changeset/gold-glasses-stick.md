---
'@mastra/code-sdk': minor
---

Added support for injecting pre-built storage and vector store instances into Mastra Code. `MastraCodeConfig.storage` now accepts a `MastraCompositeStore` instance in addition to a storage config, and the new `MastraCodeConfig.vector` slot accepts a `MastraVector` instance. When an instance is provided it is used as-is — no connection test or LibSQL fallback — so hosted deployments can share a single Postgres connection pool between Mastra storage and application tables.

**Before**

```ts
await createMastraCode({ storage: { backend: 'pg', connectionString } });
```

**After**

```ts
const storage = new PostgresStore({ id: 'code-storage', connectionString });
const vector = new PgVector({ id: 'code-vectors', connectionString });
await createMastraCode({ storage, vector });
```
