---
'@mastra/core': minor
---

Add embedderOptions support to Memory for AI SDK 5+ provider-specific embedding options

With AI SDK 5+, embedding models no longer accept options in their constructor. Options like `outputDimensionality` for Google embedding models must now be passed when calling `embed()` or `embedMany()`. This change adds `embedderOptions` to Memory configuration to enable passing these provider-specific options.

You can now configure embedder options when creating Memory:

```typescript
import { Memory } from '@mastra/core';
import { google } from '@ai-sdk/google';

// Before: No way to specify providerOptions
const memory = new Memory({
  embedder: google.textEmbeddingModel('text-embedding-004'),
});

// After: Pass embedderOptions with providerOptions
const memory = new Memory({
  embedder: google.textEmbeddingModel('text-embedding-004'),
  embedderOptions: {
    providerOptions: {
      google: {
        outputDimensionality: 768,
        taskType: 'RETRIEVAL_DOCUMENT',
      },
    },
  },
});
```

This is especially important for:
- Google `text-embedding-004`: Control output dimensions (default 768)
- Google `gemini-embedding-001`: Reduce from default 3072 dimensions to avoid pgvector's 2000 dimension limit for HNSW indexes

Fixes #8248
