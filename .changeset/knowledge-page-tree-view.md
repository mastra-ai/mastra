---
'@mastra/playground-ui': patch
---

Added `KnowledgePageTree`, `KnowledgePageDetail` and `KnowledgePageGraph` to the Knowledge explorer. The graph draws scopes and pages with their parent links and mentions, and marks pinned pages. The tree nests scopes and pages in stored order, opens the path to a page selected elsewhere (graph or search), and supports arrow-key navigation. The detail pane shows a page's home scope, synopsis, body, pin audience and notes, with each note's stamped scopes and author and links for resolved `[[mentions]]`.
