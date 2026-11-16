---
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added `KnowledgeInvalidCursorError`, thrown when a Knowledge list call gets a cursor the store did not issue.
