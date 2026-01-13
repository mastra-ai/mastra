---
'@mastra/core': minor
'@mastra/pg': minor
---

feat(storage): change TABLE_THREADS.metadata from TEXT to JSONB

The `metadata` column in the `mastra_threads` table has been changed from `TEXT` to `JSONB`. This provides native JSONB operators, GIN indexing support, and consistency with other tables.

**PostgreSQL Migration Required:**

PostgreSQL users with existing tables must migrate the column type. Other databases (LibSQL, ClickHouse, etc.) do not require migration.

Option 1: Use the helper method (recommended)
```typescript
const store = new PostgresStore({ id: 'my-store', connectionString: '...' });
await store.init();
const result = await store.migrateThreadsMetadataToJsonb();
```

Option 2: Run SQL directly
```sql
ALTER TABLE mastra_threads
ALTER COLUMN metadata TYPE jsonb
USING metadata::jsonb;
```

New installations automatically use JSONB. Existing applications continue to work without migration, but JSONB-specific features (native operators, GIN indexing) require migration.
