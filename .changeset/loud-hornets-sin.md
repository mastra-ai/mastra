---
'@mastra/core': minor
---

Added `maxChunkChars` to the semantic recall options. Messages longer than this many characters are split into chunks, and each chunk is stored as its own vector row, so long messages no longer fail to embed or lose the text past the embedder's input limit. The default is 16,384 characters, about 4,096 tokens of English text. Lower it for Chinese, Japanese, or Korean text, or code.

```typescript
const memory = new Memory({
  options: {
    semanticRecall: { topK: 3, messageRange: 1, maxChunkChars: 6000 },
  },
});
```

The `SemanticRecall` processor now splits long messages into chunks and stores the thread's metadata on each vector row, instead of embedding the whole text as one input.
