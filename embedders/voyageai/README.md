# @mastra/voyageai

VoyageAI embeddings integration for Mastra. Provides text, multimodal, and contextualized chunk embeddings using the official VoyageAI TypeScript SDK.

## Installation

```bash
npm install @mastra/voyageai
```

## Usage

### Text Embeddings

```typescript
import { voyage, voyageEmbedding } from '@mastra/voyageai';

// Use default model (voyage-3.5)
const result = await voyage.doEmbed({ values: ['Hello world'] });
console.log(result.embeddings[0].length);

// Use specific model with options
const model = voyageEmbedding({
  model: 'voyage-3-large',
  inputType: 'query',
  outputDimension: 512,
});
const queryResult = await model.doEmbed({ values: ['search query'] });
```

## Documentation

- [VoyageAI embedding models and configuration](https://mastra.ai/models/embeddings#voyageai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/embedders/voyageai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
