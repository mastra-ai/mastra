---
'@mastra/memory': patch
---

Fix updateMessages() to sync vector database for semantic recall. Previously, updating a message's content would not update the corresponding vector embeddings, causing semantic recall to return stale results based on old content.
