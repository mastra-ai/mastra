---
"@mastra/memory": patch
---

Fix cascading cleanup of vector embeddings when memory threads or messages are deleted. Previously, deleting a thread or messages removed records from the memory store but left orphaned vector embeddings in the vector store, causing buildup of stale vectors. This change ensures that:
- Deleting a thread removes all associated vector embeddings
- Deleting messages removes their corresponding vector embeddings
- Cleanup runs as fire-and-forget (non-blocking) after storage deletion completes
- Works across all supported vector store backends

Fixes `#12225`
