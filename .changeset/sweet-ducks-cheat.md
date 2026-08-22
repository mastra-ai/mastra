---
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Fixed dynamic workflow definitions so an explicit author cannot replace an existing owner. Owner-qualified updates now remain safe if a definition is deleted and recreated concurrently, while omitting the author preserves legacy unscoped update behavior.
