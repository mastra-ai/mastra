---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge explorer no longer lays its graph out again each time it re-renders: pages built from the tree's query results are kept while they hold the same pages.
