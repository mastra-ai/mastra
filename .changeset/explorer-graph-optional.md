---
'@mastra/playground-ui': patch
---

`KnowledgePageExplorer` takes `graph={undefined}` while the overview graph loads, and a `graphError` message when it fails. The tree, search and selected page work during the wait, the graph canvas shows a loader until it has pages to draw, and pins and mention links appear once the graph arrives. A failed top tree level now says "Couldn’t load the pages." instead of leaving the tree empty.
