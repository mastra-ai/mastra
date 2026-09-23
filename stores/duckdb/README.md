# @mastra/duckdb

DuckDB vector store implementation for Mastra, providing high-performance embedded vector similarity search with HNSW indexing. No external server required - runs entirely in-process.

## Installation

```bash
npm install @mastra/duckdb
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { Mastra } from '@mastra/core';
import { DuckDBVector } from '@mastra/duckdb';

const vectorStore = new DuckDBVector({
  id: 'rag-store',
  path: './rag-vectors.duckdb',
});

// Use with Mastra's RAG system
const mastra = new Mastra({
  vectors: {
    ragStore: vectorStore,
  },
});
```

## Documentation

- [DuckDB integration guide](https://mastra.ai/integrations/databases/duckdb)
- [DuckDB vector reference](https://mastra.ai/reference/vectors/duckdb)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/duckdb/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
