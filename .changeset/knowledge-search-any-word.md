---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

`knowledge_search` now finds pages that match any word of the query, not only pages that match every word. Pages with more of the query's words rank higher, so a long question still finds the page that holds most of its words. A page whose name contains the whole query still comes first. When several pages match the same number of words, a word in the name counts more than one in the description, and one in the description more than one in the body. A search uses the first 16 words of the query.
