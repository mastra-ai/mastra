---
'@mastra/pg': patch
---

Fixed PgVector `query()`, `upsert()`, `updateVector()`, `deleteVector()`, and `deleteVectors()` failing with `column "namespace" does not exist` on vector tables created before `@mastra/pg` 1.22.

The namespace column migration previously ran only inside `createIndex()`, so tables that were only read after upgrading were never migrated. The migration now runs lazily (once per index per process) from every data path, and is applied atomically under a database-scoped advisory lock so it is safe across concurrent processes.

When schema changes are disabled via `disableInit` or `MASTRA_DISABLE_STORAGE_INIT`, a descriptive `MASTRA_VECTOR_PG_ENSURE_NAMESPACE_MIGRATION_REQUIRED` error is thrown instead. In that case, either call `createIndex()` with init enabled, or run the following migration as a single transaction (replace `<index>` with the table name):

```sql
BEGIN;
SELECT pg_advisory_xact_lock((1936876916::bigint << 32) | '<index>'::regclass::oid::bigint);
ALTER TABLE <index> ADD COLUMN IF NOT EXISTS namespace VARCHAR(255) NOT NULL DEFAULT 'default';
CREATE UNIQUE INDEX IF NOT EXISTS <index>_namespace_vector_id_idx ON <index> (namespace, vector_id);
ALTER TABLE <index> DROP CONSTRAINT IF EXISTS <index>_vector_id_key;
COMMIT;
```

**What automatic migration requires**

- First access to a legacy table requires table-owner DDL permissions.
- First access takes a transaction-scoped advisory lock and PostgreSQL DDL locks.
- Already-migrated tables remain usable with SELECT-only access.
- Failed or incomplete migrations are retried on the next operation.
- Equivalent composite unique indexes are recognized regardless of name or key order.
- For long table names, automatic migration uses a bounded hashed index name and rolls back if a conflicting index prevents reconciliation.

**Before you run the SQL above**

- The example assumes the original generated constraint name. Use the actual legacy constraint name if it was renamed.
- For a long table name, choose a unique index name of at most 63 characters.
- If an index with the same name already exists, verify it is a valid, non-partial unique index on exactly `namespace` and `vector_id` before dropping the legacy constraint.

Fixes #23272
