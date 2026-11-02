---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

`knowledge_search` finds pages that match any word of the query and ranks them by how many words they match, instead of requiring every word. A matched word counts for more in a page's name than in its description, and more in its description than in its body, so a long question still surfaces the page whose name or description it mentions. A page whose name contains the whole query still comes first. Ranking happens inside each store (in-memory, LibSQL, PostgreSQL, MySQL and MongoDB) before the result limit, and access checks run before ranking as before. Quoted phrases are still searched as plain words. When nothing matches any word, the "no results" hint now says so.
