---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
---

Added storage for the stored-scorer versions an experiment pins (`scorerVersions`). Existing experiments tables gain the column automatically on startup.
