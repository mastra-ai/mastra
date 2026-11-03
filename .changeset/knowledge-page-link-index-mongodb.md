---
'@mastra/mongodb': patch
---

MongoDB now stores the Knowledge page link index, so `countPageLinks()` and `listPageLinks()` work on MongoDB Knowledge stores. The new `mastra_knowledge_page_links` collection is created on startup; links for existing pages fill in on `knowledge.reindexLinks()` or the page's next write.
