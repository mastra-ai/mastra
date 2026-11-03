---
'@mastra/playground-ui': patch
'mastra': patch
---

Focusing a page in the Knowledge graph view now loads its children into the graph, linked to it, including children the initial graph didn't load. Up to 24 are added for each focused page. The rest are counted in a "+N more pages … not drawn" line.
