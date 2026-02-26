---
"@mastra/memory": patch
---

Fix cascading cleanup of vector embeddings when memory threads or messages are deleted. Previously, deleting a thread or messages removed records from the memory store but left orphaned vector embeddings in the vector store, causing buildup of stale vectors. This change ensures that:
- Deleting a thread removes all associated vector embeddings
- Deleting messages removes their corresponding vector embeddings
- Cleanup runs as fire-and-forget (non-blocking) after storage deletion completes
- Index name matching uses the vector store's `indexSeparator` to support all backends (e.g. `memory_messages` for PG, `memory-messages` for Pinecone)

Fixes `#12225`
