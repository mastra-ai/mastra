---
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/platform': patch
'@mastra/core': patch
---

PostgreSQL and LibSQL Knowledge storage read a page's parents with one recursive query, so importer flushes make fewer database round trips for deep pages.
