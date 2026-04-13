---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed "column does not exist" errors when using experiment review features on databases created before the review pipeline was introduced. Startup now automatically migrates older experiment tables to the latest schema.
