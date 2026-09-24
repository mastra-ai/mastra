---
'@mastra/core': minor
---

Semantic recall now works with a vector store that generates embeddings itself, so a self-embedding store needs no client-side `embedder`.

`MastraVector` gains `isSelfEmbedding`, a getter defaulting to false. Stores that expect the caller to supply vectors are unaffected. When a store reports true and no embedder is configured, `Memory` sends text rather than vectors: the index is created without a dimension, writes carry `documents`, and queries carry `queryText`. The index is named `memory_messages_selfembed` so it cannot collide with one holding client-supplied vectors.

Configuring semantic recall with neither an embedder nor a self-embedding store now says so, naming both options.
