---
'@mastra/pg': patch
---

Postgres now stores the Knowledge page link index, so `countPageLinks()` and `listPageLinks()` work on Postgres Knowledge stores. The new `mastra_knowledge_page_links` table is created on startup without a schema change; links for existing pages fill in on `knowledge.reindexLinks()` or the page's next write.
