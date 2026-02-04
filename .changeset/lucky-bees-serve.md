---
'@mastra/core': patch
---

**Fixed**
Workspace search index names now use underscores so they work with SQL-based vector stores (PgVector, LibSQL).

**Added**
You can now set a custom index name with `searchIndexName`.

**Why**
Some SQL vector stores reject hyphens in index names.

**Example**
```ts
// Before - would fail with PgVector
new Workspace({ id: 'my-workspace', vectorStore, embedder });

// After - works with all vector stores
new Workspace({ id: 'my-workspace', vectorStore, embedder });

// Or use a custom index name
new Workspace({ vectorStore, embedder, searchIndexName: 'my_workspace_vectors' });
```

Fixes #12656
