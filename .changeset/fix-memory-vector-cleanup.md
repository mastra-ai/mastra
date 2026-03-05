---
"@mastra/memory": patch
---

Fixed orphaned vector embeddings accumulating when memory threads or messages are deleted. Calling `memory.deleteThread()` or `memory.deleteMessages()` now automatically cleans up associated vector embeddings across all supported vector store backends. Cleanup is non-blocking and does not slow down the delete call. Also fixed `updateMessages` not cleaning up old vectors correctly when using a non-default index separator (e.g. Pinecone).
