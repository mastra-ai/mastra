# @mastra/rag

`@mastra/rag` provides document chunking, reranking, and graph-based retrieval utilities for retrieval-augmented generation. Use it to prepare source material for embedding and select the most relevant context before an agent generates a response.

## Installation

```bash
npm install @mastra/rag
```

## Usage

Create a document and split it into chunks before embedding or indexing the content.

```typescript
import { MDocument } from '@mastra/rag';

const document = MDocument.fromText(`
# Product guide

Mastra provides agents, workflows, memory, and retrieval tools.
`);

const chunks = await document.chunk({
  strategy: 'recursive',
  maxSize: 512,
  overlap: 50,
});
```

## Documentation

- [@mastra/rag documentation](https://mastra.ai/reference/rag/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/rag/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
