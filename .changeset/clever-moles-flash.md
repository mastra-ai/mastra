---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed agent version storage to persist the requestContextSchema field. Previously, requestContextSchema was defined on the agent snapshot type but was not included in the database schema, INSERT statements, or row parsing logic, causing it to be silently dropped when saving and loading agent versions.
