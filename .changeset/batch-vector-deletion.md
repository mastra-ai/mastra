---
'@mastra/memory': patch
---

Improved vector deletion performance during message cleanup by batching delete calls. Previously each message triggered a separate database call — now messages are batched (up to 100 per call) using the `$in` filter operator, reducing database load when deleting threads with many messages.

Also fixed a bug where the `updateMessages` vector cleanup used a hardcoded underscore separator instead of the vector store's configured `indexSeparator`, which caused Pinecone and Vectorize stores to miss existing indexes during cleanup.
