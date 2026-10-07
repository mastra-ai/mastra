---
'@mastra/lance': patch
---

Fixed `LanceVectorStore.createIndex()` rebuilding an existing vector index on every call. Calling it again with the same column, index type, distance metric and build settings now reuses the existing index; changed settings or indexes replaced outside Mastra still trigger a rebuild.
