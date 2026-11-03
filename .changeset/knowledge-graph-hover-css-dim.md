---
'@mastra/playground-ui': patch
'mastra': patch
---

Pointing at a page in the Knowledge graph no longer rebuilds every circle and line: fading the pages that aren't connected to it is a CSS rule driven by one attribute on the graph and a mark on the few neighbours.
