---
'@mastra/pg': patch
---

# Fix namespace migration for long vector table names

- Fix `PgVector.createIndex()` failing for table names of 40 or more characters by bounding generated index names with a 128-bit hash suffix. Short names remain unchanged.
- Preserve legacy vector-ID uniqueness if replacement-index creation fails by creating the namespace unique index before dropping the legacy constraint.
- Repair tables left half-migrated by earlier versions on the next `createIndex()` call, provided they contain no duplicate `(namespace, vector_id)` pairs.

Fixes #23273
