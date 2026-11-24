---
'@mastra/playground-ui': patch
---

Allowed the Knowledge page tree and selected page to load while the graph is pending. Pass the new optional `graphError` prop to `KnowledgePageExplorer` when the graph fails: the tree stays usable and the canvas shows the error.
