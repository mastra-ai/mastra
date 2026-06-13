---
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Foreach loops now retain completed iteration results, preventing data loss during concurrent workflow execution.
