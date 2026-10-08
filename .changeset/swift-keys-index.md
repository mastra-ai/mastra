---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge reads filtered by caller scope (node lists, search, activity, thread records) now use indexed scope keys instead of scanning every row's scope JSON, so they stay fast as Knowledge grows. New record and activity scope indexes are created automatically on the next Knowledge initialization.
