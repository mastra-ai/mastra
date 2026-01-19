---
'@mastra/qdrant': minor
---

Add full support for Qdrant named vectors, allowing collections with multiple vector spaces.

- Added `namedVectors` parameter to `createIndex()` for creating multi-vector collections
- Added `vectorName` parameter to `upsert()` for inserting into specific vector spaces
- Added `using` parameter to `query()` for querying specific vector spaces
- Changed `client` from `private` to `protected` to enable subclass extension
- Added vector name validation when upserting to named vector collections