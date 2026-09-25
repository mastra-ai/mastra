---
'@mastra/core': minor
---

Semantic recall now works with a vector store that generates embeddings itself, so a self-embedding store needs no client-side `embedder`.

Added `isSelfEmbedding` to `MastraVector`. It defaults to false, so every existing store is unaffected. A store that embeds text itself reports true:

```ts
class MyVector extends MastraVector {
  override get isSelfEmbedding() {
    return true;
  }
}

const memory = new Memory({
  storage,
  vector: new MyVector(),
  options: { semanticRecall: true },
});
```

A configured `embedder` still takes precedence, so adding one to the example above returns to client-side embedding.

Messages embedded by the store are kept in an index named `memory_messages_selfembed`, separate from the indexes holding client-supplied vectors.

Configuring semantic recall with neither an embedder nor a self-embedding store now says so, naming both options.
