---
'@mastra/core': patch
'@mastra/playground-ui': patch
'mastra': patch
---

Knowledge tree child counts now say when they were capped. If a scope has more child scopes than the 1,000 the tree looks through for each level, the page gets `childCountCapped: true` and its `childCount` is a lower bound. The Knowledge explorer then shows the count as "1000+" in the tree and in the graph's "pages under" line, instead of a number that's too low.
