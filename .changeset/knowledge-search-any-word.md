---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

`knowledge_search` finds pages that match any word of the query and ranks them by how many of the words they contain, so a long question still surfaces the page that holds most of its words. Among pages with the same number of words, a word in a page's name counts for more than one in its description, and one in its description for more than one in its body, then the newest page wins. A page whose name contains the whole query still comes first. Ranking happens inside each store (in-memory, LibSQL, PostgreSQL, MySQL and MongoDB) before the result limit, and access checks run before ranking as before. Quoted phrases are still searched as plain words. When nothing matches any word, the "no results" hint now says so.
