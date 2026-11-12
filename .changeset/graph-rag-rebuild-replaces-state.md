---
'@mastra/rag': patch
---

Rebuilding a `GraphRAG` instance with `createGraph` now replaces its previous nodes and edges instead of retaining stale graph content. If a rebuild fails, the existing graph remains intact.
