---
'@mastra/factory': minor
---

Added `embedder` and `embedderOptions` to `MastraFactory`. A deployment can now embed memory recall with a hosted model instead of local fastembed, which runs on the Factory host and competes with the server for CPU. The model is built once at startup, so a missing provider key stops the boot instead of failing the first recall.

```ts
new MastraFactory({
  storage,
  vector,
  // Reads OPENAI_API_KEY. Any provider/model embedding id, a Mastra gateway id or an AI SDK embedding model also works.
  embedder: 'openai/text-embedding-3-small',
});
```

One embedder serves every account on the deployment, on the operator's key.

Vector indexes are named by dimension, so after switching to a model with a different dimension, recall only finds content observed after the switch. Don't switch between two models with the same dimension on one vector store, including from the default fastembed to a 384-dimension model: their vectors would share an index, can't be compared, and recall would return wrong results without an error.
