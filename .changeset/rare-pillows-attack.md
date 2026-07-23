---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fix factory storage error classification and schema drift handling.

- `isUniqueViolation` in the LibSQL factory storage now only matches real unique-index violations (`SQLITE_CONSTRAINT_UNIQUE` / `SQLITE_CONSTRAINT_PRIMARYKEY`). Previously any `SQLITE_CONSTRAINT` failure — including NOT NULL violations — was reported as a "Unique constraint violation", which masked the real error (seen as `Unique constraint violation on collection 'factory_rule_evaluations'` when polled ingestion inserted nullable columns into a stale table).
- `ensureCollections` in both the LibSQL and Postgres factory storage adapters now relaxes stale NOT NULL constraints when a column becomes nullable in the schema. Postgres uses `ALTER COLUMN ... DROP NOT NULL`; LibSQL rebuilds the table in place since SQLite cannot drop NOT NULL directly. Existing rows and unique indexes are preserved.
