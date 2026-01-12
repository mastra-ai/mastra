---
'@mastra/lance': patch
---

Fixed `createIndex` failing with "tableName is required" when used with Memory.

When using `LanceVectorStore` with `@mastra/memory`, the `createIndex` method would throw an error because Memory calls it without a `tableName` parameter. The `tableName` parameter now defaults to `indexName` when not provided, matching the behavior of other vector stores like PgVector.

Fixes #11716
