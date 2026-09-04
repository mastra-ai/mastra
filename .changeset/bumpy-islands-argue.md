---
'@mastra/dsql': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/oracledb': patch
'@mastra/spanner': patch
---

Fixed scoped trace deletion to reject unsupported tenant filters instead of deleting data without scope.
