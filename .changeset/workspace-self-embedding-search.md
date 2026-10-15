---
'@mastra/core': minor
---

Added Workspace vector and hybrid search for vector stores that generate embeddings themselves, such as `MongoDBVector` with `autoEmbed`. The `embedder` option is no longer required for these stores: Mastra sends document and query text to the store instead of vectors.

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  bm25: true,
  vectorStore: new MongoDBVector({ id: 'ws-vector', uri, dbName, autoEmbed: { model: 'voyage-4' } }),
})
```

Without a `searchIndexName`, these workspaces default to the `<id>_search_selfembed` index. Server-embedded documents and client-supplied vectors then use different default indexes. A shared custom `searchIndexName` overrides this. Providing an `embedder` still takes precedence.
