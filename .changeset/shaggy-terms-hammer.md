---
'@mastra/code-sdk': minor
---

Added `embedder` and `embedderOptions` to `createMastraCode` for recall search. Pass a `provider/model` string, a Mastra gateway id, or an AI SDK embedding model to embed with it instead of local fastembed.

```ts
const mastraCode = await createMastraCode({ vector, embedder: 'openai/text-embedding-3-small' });
```
