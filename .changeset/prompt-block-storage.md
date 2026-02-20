---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
---

Added `requestContextSchema` field to prompt block storage types, enabling prompt blocks to define their own variables schema. Prompt block server endpoints now compute a `hasDraft` indicator for accurate draft/published badge display. All storage backends (LibSQL, PostgreSQL, MongoDB) now persist and retrieve `requestContextSchema` for prompt block versions, with automatic schema migrations for existing databases.
