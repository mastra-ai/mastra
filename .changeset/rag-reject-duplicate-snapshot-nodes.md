---
'@mastra/rag': patch
---

Reject duplicate node IDs when restoring a GraphRAG snapshot instead of silently replacing the first node. Calling `addNode` directly can still update a node.
