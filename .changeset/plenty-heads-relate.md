---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge list calls now throw `KnowledgeInvalidCursorError` for a malformed cursor, so servers can answer 400 instead of 500.
