---
'@mastra/voyageai': patch
---

Added the `rerank-3` and `rerank-3-lite` VoyageAI reranker models to `VoyageRerankerModel` and `RERANKER_MODEL_INFO`.

`rerank-2.5` remains the default. `rerank-3` and `rerank-3-lite` are out of Preview in the Voyage AI API.

```ts
import { createVoyageReranker } from '@mastra/voyageai';

const reranker = createVoyageReranker('rerank-3-lite');
```
