---
'@mastra/pg': patch
---

Fixed PgVector `query()`, `upsert()`, `updateVector()`, `deleteVector()`, and `deleteVectors()` failing with `column "namespace" does not exist` on vector tables created before `@mastra/pg` 1.22.

The namespace column migration previously ran only inside `createIndex()`, so tables that were only read after upgrading were never migrated. The migration now runs lazily (once per index per process) from every data path, and is applied atomically under a database-scoped advisory lock so it is safe across concurrent processes.

When schema changes are disabled via `disableInit` or `MASTRA_DISABLE_STORAGE_INIT`, a descriptive `MASTRA_VECTOR_PG_ENSURE_NAMESPACE_MIGRATION_REQUIRED` error is thrown instead. In that case, either call `createIndex()` with init enabled, or run the following migration as a single transaction (replace `<index>` with the table name):

```sql
BEGIN;
ALTER TABLE <index> ADD COLUMN IF NOT EXISTS namespace VARCHAR(255) NOT NULL DEFAULT 'default';
ALTER TABLE <index> DROP CONSTRAINT IF EXISTS <index>_vector_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS <index>_namespace_vector_id_idx ON <index> (namespace, vector_id);
COMMIT;
```

Fixes #23272
