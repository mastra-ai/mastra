---
'@mastra/playground-ui': patch
'mastra': patch
---

When the Knowledge graph focuses a deep page, the page tree keeps scrolling to its row as the levels above it finish loading, so the row ends up in view instead of below the fold. Scrolling the tree yourself stops it.
