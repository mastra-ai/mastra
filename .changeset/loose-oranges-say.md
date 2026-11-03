---
'@mastra/memory': minor
---

Observational Memory semantic search now works with a vector store that generates embeddings itself, so no `embedder` is needed.

With MongoDB Automated Embedding, MongoDB embeds each observation when it is written and the search string when you query:

```ts
const memory = new Memory({
  storage,
  vector: new MongoDBVector({ id: 'vec', uri, dbName, autoEmbed: { model: 'voyage-4' } }),
  options: { observationalMemory: { retrieval: { vector: true } } },
});

await memory.searchMessages({ query: 'What deadline did we agree on?', resourceId: 'user-123' });
```

The agent's `recall` tool searches the same way. Observations are indexed under `memory_observations_selfembed`. Configurations that pass an `embedder` keep working unchanged.
