---
"@mastra/core": minor
---

Make `queryVector` optional in the `QueryVectorParams` interface to support metadata-only queries. At least one of `queryVector` or `filter` must be provided. Not all vector store backends support metadata-only queries — check your store's documentation for details.

Also fixes documentation where the `query()` parameter was incorrectly named `vector` instead of `queryVector`.
