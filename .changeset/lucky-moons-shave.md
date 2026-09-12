---
'@mastra/code-sdk': patch
---

`/prune vacuum` no longer compacts local libSQL databases that carry a `libsql_vector_idx` vector index. Any VACUUM over such a database deterministically corrupts its `libsql_vector_meta_shadow` table — silently at first, since vector queries keep returning rows — and compounds over repeated runs until `REINDEX` can no longer repair it. Databases are now detected by schema (not filename), skipped rather than compacted, and reported in `/prune` output with the reason, so the skip is never silent. Detection fails closed: a database whose schema cannot be inspected is left untouched instead of vacuumed. Ordinary databases are still compacted as before.
