---
'@mastra/pg': minor
---

Remove pg-promise dependency and use pg.Pool directly

**BREAKING CHANGE**: This release replaces pg-promise with vanilla node-postgres (`pg`).

### Breaking Changes

- **Removed `store.pgp`**: The pg-promise library instance is no longer exposed
- **Config change**: `{ client: pgPromiseDb }` is no longer supported. Use `{ pool: pgPool }` instead
- **Cloud SQL config**: `max` and `idleTimeoutMillis` must now be passed via `pgPoolOptions`

### New Features

- **`store.pool`**: Exposes the underlying `pg.Pool` for direct database access or ORM integration (e.g., Drizzle)
- **`store.db`**: Provides a `DbClient` interface with methods like `one()`, `any()`, `tx()`, etc.
- **`store.db.connect()`**: Acquire a client for session-level operations

### Migration

```typescript
// Before (pg-promise)
import pgPromise from 'pg-promise';
const pgp = pgPromise();
const client = pgp(connectionString);
const store = new PostgresStore({ id: 'my-store', client });

// After (pg.Pool)
import { Pool } from 'pg';
const pool = new Pool({ connectionString });
const store = new PostgresStore({ id: 'my-store', pool });

// Use store.pool with any library that accepts a pg.Pool
```
