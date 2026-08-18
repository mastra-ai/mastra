---
'@mastra/rag': minor
---

Added `serialize()` and `GraphRAG.deserialize()` so a knowledge graph can be saved and restored instead of rebuilt on every process start. Building a graph compares every chunk against every other chunk, which is slow for large document sets; now you can do that work once and reload the result.

```typescript
// Before: the graph had to be rebuilt every time
const graphRag = new GraphRAG(1536, 0.7);
graphRag.createGraph(documentChunks, embeddings);

// After: build once, save the snapshot, and reload it later
const snapshot = graphRag.serialize();
await writeFile('./graph.json', JSON.stringify(snapshot));

const restored = GraphRAG.deserialize(JSON.parse(await readFile('./graph.json', 'utf8')));
restored.query({ query: queryEmbedding, topK: 10 });
```

A snapshot is plain JSON, so you can store it in any database, file, or cache you already use. Loading a snapshot that does not match the graph's embedding dimension now fails immediately with a clear error instead of later during a query. Closes #3926.
