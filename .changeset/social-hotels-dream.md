---
'@mastra/lance': patch
---

Fixed `LanceVectorStore` failing when used with Memory.

When using `LanceVectorStore` with `@mastra/memory`, operations would fail because Memory calls methods without a `tableName` parameter. The `tableName` parameter now defaults to `indexName` when not provided in `createIndex`, `query`, and `upsert` methods, matching the behavior of other vector stores like PgVector.

Fixes #11716
