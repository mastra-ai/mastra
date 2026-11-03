---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Changes to an experimental, upcoming memory feature.

The Knowledge storage domain now stores Knowledge as pages, notes and pins (schema 4) instead of nodes and records. On startup, the tables of the earlier experimental Knowledge node store (shipped in 1.79.0) are dropped, with any rows in them, and the new tables are created; this also happens if an older process recreates them during a rolling deploy. Memory and other tables are never touched. On MongoDB, Knowledge collections found without a schema version (for example, left by an interrupted first start) are adopted as schema 4 rather than refused. Don't run `dangerouslyReset()` from an older version against a database the new version already uses. Knowledge pages need a `@mastra/core` release that includes them; with an older core, the other storage domains keep working.
