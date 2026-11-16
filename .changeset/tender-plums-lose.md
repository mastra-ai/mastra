---
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Knowledge list calls now throw `KnowledgeInvalidCursorError` for a cursor the store did not issue, so servers answer 400 instead of 500.
