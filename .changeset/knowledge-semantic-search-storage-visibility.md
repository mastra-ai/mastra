---
'@mastra/memory': patch
---

Knowledge semantic search now confirms every hit against Knowledge storage before returning it. A vector whose metadata is out of date (written before a node or record was rescoped, or by an indexing worker whose claim had expired) can no longer show that node or record to a caller outside its current scopes.
