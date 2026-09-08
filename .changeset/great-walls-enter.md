---
'@mastra/pg': patch
---

Fixed PgVector `query()`, `upsert()`, `updateVector()`, `deleteVector()`, and `deleteVectors()` failing with `column "namespace" does not exist` on vector tables created before `@mastra/pg` 1.22.

The namespace column migration previously ran only inside `createIndex()`, so tables that were only read after upgrading were never migrated. The migration now runs lazily (once per index per process) from every data path, and is applied atomically under a database-scoped advisory lock so it is safe across concurrent processes.

When schema changes are disabled via `disableInit` or `MASTRA_DISABLE_STORAGE_INIT`, a descriptive `MASTRA_VECTOR_PG_ENSURE_NAMESPACE_MIGRATION_REQUIRED` error is thrown instead. In that case, either call `createIndex()` with init enabled, or run the following migration as a single transaction (replace `<index>` with the table name):

```sql
BEGIN;
SELECT pg_advisory_xact_lock(1936876916, '<index>'::regclass::oid::int);
ALTER TABLE <index> ADD COLUMN IF NOT EXISTS namespace VARCHAR(255) NOT NULL DEFAULT 'default';
CREATE UNIQUE INDEX IF NOT EXISTS <index>_namespace_vector_id_idx ON <index> (namespace, vector_id);
ALTER TABLE <index> DROP CONSTRAINT IF EXISTS <index>_vector_id_key;
COMMIT;
```

First access to a legacy table requires table-owner DDL permissions and takes a transaction-scoped advisory lock plus PostgreSQL DDL locks. Already-migrated tables remain usable with SELECT-only access. Failed or incomplete migrations are retried on the next operation; equivalent composite unique indexes are recognized regardless of name or key order.

The SQL example assumes the original generated constraint name. Use the actual legacy constraint name if it was renamed, choose a unique index name of at most 63 characters for long table names, and verify any pre-existing same-named index is a valid, non-partial unique index on exactly `namespace` and `vector_id` before dropping the legacy constraint. Automatic migration uses a bounded hashed name for long tables and rolls back if a conflicting index prevents reconciliation.

Fixes #23272
