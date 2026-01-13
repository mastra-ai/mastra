---
'@mastra/lance': patch
---

Fixed `LanceVectorStore` failing when used with Memory.

When using `LanceVectorStore` with `@mastra/memory`, operations would fail because Memory calls methods without a `tableName` parameter. The `tableName` parameter now defaults to `indexName` when not provided in `createIndex`, `query`, and `upsert` methods, matching the behavior of other vector stores like PgVector.

Additionally fixed three critical bugs:

1. **Upsert replacing entire table**: The `upsert` method was using `mode: 'overwrite'` which replaced all rows in the table instead of updating only the specified rows. Now uses LanceDB's `mergeInsert` for proper upsert semantics (update existing rows, insert new ones).

2. **UpdateVector replacing entire table**: The `updateVector` method had the same issue - using `mode: 'overwrite'` caused all other rows to be deleted. Now uses `mergeInsert` to only update the targeted rows.

3. **Query not returning metadata by default**: When querying without specifying `columns`, only the `id` field was returned, causing metadata to be empty even though filters worked on metadata fields. Now returns all columns by default.

Fixes #11716
