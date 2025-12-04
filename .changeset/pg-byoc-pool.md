---
"@mastra/pg": minor
---

Add BYOC (Bring Your Own Client) pool support for PostgresStore and PgVector

**Features:**

- PostgresStore now uses `pg.Pool` directly instead of `pg-promise`, enabling support for HTTP-based drivers like `@neondatabase/serverless`
- Added `pool` parameter to both PostgresStore and PgVector for passing your own pg.Pool instance
- Exposes `store.pool` and `pgVector.pool` for direct access to the underlying connection pool
- Share a single pool between PgVector and PostgresStore for memory optimization in serverless environments
- Supports Neon serverless driver, PlanetScale, and other pg-compatible HTTP drivers

**Breaking Changes:**

- Removed `client` parameter (pg-promise IDatabase) from PostgresStore - use `pool` instead
- Removed `store.pgp` property - use `store.pool` for direct database access

**Migration:**

```typescript
// Before (pg-promise client - no longer supported)
const store = new PostgresStore({
  client: pgPromiseDb,
});

// After (pg.Pool)
import { Pool } from "pg";
const pool = new Pool({ connectionString: "..." });
const store = new PostgresStore({ pool });

// Shared pool between vector and storage
const vectorStore = new PgVector({ pool });
const store = new PostgresStore({ pool });
```

