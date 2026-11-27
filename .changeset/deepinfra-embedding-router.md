---
'@mastra/core': patch
---

`ModelRouterEmbeddingModel` now accepts namespaced model IDs and routes DeepInfra embeddings to their default endpoint. IDs with more than one slash, such as `deepinfra/BAAI/bge-base-en-v1.5`, previously failed with "Invalid model string format"; the router now splits the provider from the model at the first slash and keeps the rest of the ID intact. DeepInfra has no URL in the provider registry, so embeddings now fall back to `https://api.deepinfra.com/v1/openai` unless an explicit `url` is passed.

```ts
const embedder = new ModelRouterEmbeddingModel('deepinfra/BAAI/bge-base-en-v1.5')
await embedMany({ model: embedder, values: ['Hello world'] })
```

Fixes #31618.
