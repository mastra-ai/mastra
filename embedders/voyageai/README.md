# @mastra/voyageai

VoyageAI embeddings integration for Mastra - text, multimodal, and contextualized chunk embeddings. Use `@mastra/voyageai` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/voyageai
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { voyageEmbedding } from '@mastra/voyageai';

const model = voyageEmbedding({
  model: 'voyage-3.5',
  inputType: 'query', // 'query' | 'document' for retrieval optimization
  outputDimension: 512, // 256 | 512 | 1024 | 2048
  outputDtype: 'float', // 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary'
  truncation: true, // Handle long inputs
  baseUrl: 'https://ai.mongodb.com/v1', // Optional: custom endpoint (e.g. MongoDB-hosted Voyage)
});
```

## Documentation

- [@mastra/voyageai documentation](https://mastra.ai/reference/rag/embeddings)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/embedders/voyageai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
