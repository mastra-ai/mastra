---
'@mastra/elasticsearch': patch
---

Fix updateVector losing embedding data when only updating metadata.

After the ElasticSearch upgrade from v8 to v9, `client.get()` no longer returns `dense_vector` fields in `_source`. This caused `updateVectorById` to write documents without embeddings when only metadata was being updated, effectively deleting vectors from the index.

Switched to `client.search()` with an `ids` query, which properly returns `dense_vector` fields when explicitly requested in `_source`.
