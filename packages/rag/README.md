# @mastra/rag

The Retrieval-Augmented Generation (RAG) module contains document processing and embedding utilities.

## Installation

```bash
npm install @mastra/rag
```

## Components

### Document

The `MDocument` class represents text content with associated metadata:

```typescript
import { MDocument } from '@mastra/rag';

const doc = new MDocument({
  text: 'Document content',
  metadata: { source: 'example.txt' },
});
```

[Documentation](https://mastra.ai/reference/rag/document)

<!-- Test: Should NOT trigger RAG tests - Wed Jan 21 16:45:19 CET 2026 -->

<!-- Test: Should NOT trigger RAG tests - Wed Jan 21 16:45:32 CET 2026 -->
