---
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Knowledge routes now return 400 instead of 500 for a cursor the store did not issue.
