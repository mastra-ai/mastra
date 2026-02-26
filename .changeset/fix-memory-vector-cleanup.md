---
"@mastra/memory": patch
---

Fixed cascading cleanup of vector embeddings when memory threads or messages are deleted. Previously, deleting a thread or messages removed records from the memory store but left orphaned vector embeddings in the vector store, causing buildup of stale vectors. This change ensures that:
- Deleting a thread removes all associated vector embeddings
- Deleting messages removes their corresponding vector embeddings
- Cleanup runs as fire-and-forget (non-blocking) after storage deletion completes
- Works across all supported vector store backends

Vector deletions are batched (up to 100 message IDs per call) using the `$in` filter operator to avoid overwhelming the database when threads have many messages. Also fixed `updateMessages` vector cleanup using a hardcoded separator instead of the vector store's configured `indexSeparator`.

Fixes `#12225`
