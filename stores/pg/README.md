# @mastra/pg

Postgres provider for Mastra - includes both vector and db storage capabilities. Use `@mastra/pg` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/pg
```

## Usage

Configure the database credentials required by your provider.

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
