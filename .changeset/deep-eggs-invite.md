---
'@mastra/voyageai': minor
---

Fixed VoyageAI multimodal embeddings sending text as bare strings (the API rejected the payload) and added a `baseUrl` option so you can point the embedder, reranker, and contextualized models at a provider-hosted Voyage endpoint.

**Before**

```ts
// multimodal text was serialized as inputs: [["text"]] -> HTTP 400
```

**After**

```ts
const embedder = voyage.multimodalEmbedding({
  model: 'voyage-multimodal-3.5',
  baseUrl: 'https://ai.mongodb.com/v1',
});
```
