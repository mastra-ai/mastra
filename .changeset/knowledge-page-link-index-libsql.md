---
'@mastra/libsql': patch
---

The LibSQL Knowledge store keeps the page link index: a `mastra_knowledge_page_links` table, created on startup in existing databases without a schema change. `countPageLinks` and `listPageLinks` answer in one query each, gated by the reader's scopes. Run `knowledge.reindexLinks()` once to index pages written before upgrading.
