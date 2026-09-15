---
'@mastra/weaviate': minor
---

Add `@mastra/weaviate`, a vector store backed by [Weaviate](https://weaviate.io/). The `WeaviateVector` class implements the full `MastraVector` contract (createIndex, upsert, query, listIndexes, describeIndex, deleteIndex, updateVector, deleteVector, deleteVectors) against `vectorizer: none` collections, with cosine/euclidean/dotproduct distance metrics and MongoDB-style metadata filtering ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $all, $exists, $and, $or, $not). Arbitrary vector ids are preserved via a deterministic UUIDv5 mapping, and the original index name is preserved despite Weaviate's collection-name capitalization. Supports local Docker and Weaviate Cloud deployments.
