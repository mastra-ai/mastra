---
'@mastra/rag': patch
---

Fixed GraphRAG self-links being stored twice, so edge lists, serialized graphs, and random-walk neighbor weights no longer double-count them.
