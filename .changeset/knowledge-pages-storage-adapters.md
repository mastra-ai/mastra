---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
'@mastra/turso': patch
---

Changes to an experimental, upcoming memory feature.

The Knowledge storage domain now stores Knowledge as pages, notes and pins (schema 4) instead of nodes and records. Existing Knowledge tables from earlier versions are left untouched and reported as needing a reset; call `await storage.stores?.knowledge?.dangerouslyReset()` to delete every Knowledge row and start on the new schema. Memory tables are never touched. Requires `@mastra/core` 1.81.0 or later; the Turso adapter requires the same minimum through its LibSQL dependency.
