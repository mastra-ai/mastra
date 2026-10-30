---
'@mastra/core': patch
---

Added read-only page-store readers to `@mastra/core/knowledge` for browsing UIs: `listKnowledgeTreeChildren` (one level of the page tree, child scopes first), `readKnowledgePage` (a page with its readable ancestors, notes, pin, referenced pages and notes that mention it), `readKnowledgePageGraph` (a bounded page graph with parent and mention edges, limits in `DEFAULT_KNOWLEDGE_PAGE_GRAPH_LIMITS`; mentions come from every note on a walked page until a graph-wide `maxNotes` budget runs out, which sets `truncated`), `searchKnowledgeExplorerPages` and `readKnowledgePageActivity`. Each takes a read scope (`'all'` for an owner view) and passes it to every store call, so pages and notes outside it never appear, mention edges included. They never write.
