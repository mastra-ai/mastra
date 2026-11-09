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

The `SemanticRecall` processor and `memory.saveMessages()` now write the same vector rows: the same text rules, chunking, and thread metadata. Messages embedded during an agent run carry thread metadata, so a `semanticRecall.filter` on thread attributes matches them.
