---
'@mastra/core': patch
---

Sped up `readKnowledgePageGraph`, which loads the Studio Knowledge graph, on large page trees. It now reads the tree a level at a time: one child-page count for the whole level, a listing only for pages that have children, one note count across the walked pages, and one lookup for linked pages outside the walk. A 300-page tree went from 1,221 sequential storage calls to 37, which matters most on remote databases such as Turso. The returned graph is unchanged.
