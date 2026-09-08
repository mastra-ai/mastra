---
'@mastra/pg': patch
---

Fixed `PgVector.createIndex()` throwing `Invalid index name` for tables whose names are 40 characters or longer. The namespace migration built a `<table>_namespace_vector_id_idx` index name that exceeded Postgres' 63-character identifier limit; long names now fall back to a truncated, hashed index name. The migration also now creates the `(namespace, vector_id)` unique index before dropping the legacy `UNIQUE (vector_id)` constraint, so a failed migration can no longer leave a table without a unique index (which previously broke `upsert()`). Tables left in that half-migrated state by earlier versions are repaired on the next `createIndex()` call.

Fixes #23273
