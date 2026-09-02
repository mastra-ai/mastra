---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `listResolved()` on versioned storage domains issuing one version query per listed entity. `@mastra/core` adds an overridable `getVersions(ids)` method that `listResolved()` uses to fetch all active versions in a single batch; adapters that don't override it keep their previous per-id behavior. `@mastra/pg` and `@mastra/libsql` override it for the agents and skills domains with a single `WHERE id IN (...)` query. Fixes https://github.com/mastra-ai/mastra/issues/22524
