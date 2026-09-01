# @mastra/lance

`@mastra/lance` provides Mastra storage and vector search backed by the embedded LanceDB database. Use it when you want local, file-based persistence and semantic search without operating a separate database service.

## Installation

```bash
npm install @mastra/lance
```

## Usage

Create a local LanceDB vector store, then create an index before writing embeddings.

```typescript
import { LanceVectorStore } from '@mastra/lance';

const vectorStore = await LanceVectorStore.create('./data/lancedb');

await vectorStore.createIndex({
  indexName: 'documents',
  dimension: 1536,
});
```

## Documentation

- [LanceDB integration guide](https://mastra.ai/integrations/databases/lancedb)
- [Lance vector reference](https://mastra.ai/reference/vectors/lance)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/lance/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
