---
'@mastra/pg': patch
---

Fixed `PgVector.createIndex()` throwing `Invalid index name` for tables whose names are 40 characters or longer. The namespace migration built a `<table>_namespace_vector_id_idx` index name that exceeded Postgres' 63-character identifier limit; long names now fall back to a truncated, hashed index name. The migration also now creates the `(namespace, vector_id)` unique index before dropping the legacy `UNIQUE (vector_id)` constraint, so replacement-index creation failures preserve legacy vector-ID uniqueness. Tables left in that half-migrated state by earlier versions are repaired on the next `createIndex()` call, provided they contain no duplicate `(namespace, vector_id)` pairs.

Fixes #23273
