---
"@mastra/core": minor
---

Workspace search now supports batch-capable embedders. Pass an embedder branded with `batch: true` (and an optional `maxBatchSize`) to embed all pending chunks for a flush in a single provider call instead of one call per chunk. This dramatically reduces index-rebuild time on large workspaces when using providers that support batch embedding (e.g. OpenAI's `embedMany`). Existing single-text embedders continue to work unchanged.

```ts
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const model = openai.embedding('text-embedding-3-small');

const workspace = new Workspace({
  // ...
  embedder: Object.assign(
    async (texts: string[]) => {
      const { embeddings } = await embedMany({ model, values: texts });
      return embeddings;
    },
    { batch: true as const, maxBatchSize: 2048 },
  ),
});
```
