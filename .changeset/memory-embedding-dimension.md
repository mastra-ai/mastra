---
'@mastra/core': minor
---

Added an `embeddingDimension` option to Memory. When you know your embedder's output dimension, setting it lets semantic recall skip the probe embedding call it otherwise makes once per Memory instance. Startup then makes no billed embedding call and doesn't fail when the embedding provider is unreachable. The vector index name stays the same, so existing indexes keep working.

```ts
const memory = new Memory({
  embedder: 'openai/text-embedding-3-small',
  embeddingDimension: 1536,
  options: { semanticRecall: true },
});
```
