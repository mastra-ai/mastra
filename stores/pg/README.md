# @mastra/pg

PostgreSQL implementation for Mastra, providing both vector similarity search (using pgvector) and general storage capabilities with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/pg
```

## Usage

### Vector Store

#### Basic Configuration

PgVector supports multiple connection methods:

**1. Connection String (Recommended)**

```typescript
import { PgVector } from '@mastra/pg';

const vectorStore = new PgVector({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
});
```

## Documentation

- [@mastra/pg documentation](https://mastra.ai/reference/vectors/pg)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/pg/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
