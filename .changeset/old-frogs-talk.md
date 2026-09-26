---
'@mastra/core': minor
---

Semantic recall now works with a vector store that generates embeddings itself, so a self-embedding store needs no client-side `embedder`.

Added `isSelfEmbedding` to `MastraVector`. It defaults to false, so every existing store is unaffected. A store that embeds text itself overrides it to return true, and semantic recall against that store needs no `embedder`:

```ts
const memory = new Memory({
  storage,
  vector: new MongoDBVector({ id: 'vec', uri, dbName, autoEmbed: { model: 'voyage-4' } }),
  options: { semanticRecall: true },
});
```

A configured `embedder` still takes precedence, so adding one to the example above returns to client-side embedding.

Messages embedded by the store are kept in an index named `memory_messages_selfembed`, separate from the indexes holding client-supplied vectors.

Configuring semantic recall with neither an embedder nor a self-embedding store now says so, naming both options.
