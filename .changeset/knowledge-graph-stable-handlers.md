---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge graph hands React Flow the same event handlers on every render, so pointing at a page no longer re-renders every node and line wrapper because of a new function identity.
