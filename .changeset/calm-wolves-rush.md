---
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
---

Implemented `updateObservationalMemoryConfig()` in Postgres, LibSQL, and MongoDB storage adapters. This enables per-record config overrides for observational memory thresholds, supporting the new `memory.updateObservationalMemoryConfig()` API in `@mastra/memory`.
