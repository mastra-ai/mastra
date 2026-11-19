---
'@mastra/memory': minor
---

Recall search no longer fails or hangs when the embedder or vector store errors or never answers. Recall stops waiting after 10 seconds, cancels the query embedding, logs an error through the Mastra logger naming the step that failed (embedding the query, opening the vector index or querying the vector store), and tells the agent to browse messages instead. Provider and database errors stay out of the conversation, and stopping the run stops the search. See #30736.

Added `retrieval.searchTimeoutMs` to change that limit, for example for a local embedding model on a slow machine:

```ts
const memory = new Memory({
  vector,
  embedder,
  options: {
    observationalMemory: { retrieval: { vector: true, searchTimeoutMs: 30_000 } },
  },
});
```

Fixed a fastembed embedder that stopped working for the rest of the process after its first embed failed or was cancelled. The next embed now takes its place, and other embeds still wait for it, so they don't race the model download.
