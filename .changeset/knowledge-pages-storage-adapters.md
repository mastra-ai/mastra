---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Changes to an experimental, upcoming memory feature.

The Knowledge storage domain now stores Knowledge as pages, notes and pins (schema 4) instead of nodes and records. Existing Knowledge tables from earlier versions are left untouched and reported as needing a reset; call `await storage.stores?.knowledge?.dangerouslyReset()` to delete every Knowledge row and start on the new schema. Memory tables are never touched. Knowledge pages need a `@mastra/core` release that includes them; with an older core, the other storage domains keep working.
