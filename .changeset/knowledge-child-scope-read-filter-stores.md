---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge stores can list and count only the child scopes a reader can see, so `knowledge_list` no longer reads every child scope to show the readable ones.
