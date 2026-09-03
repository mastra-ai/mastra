# @mastra/mysql

MySQL storage implementation for Mastra, providing persistent storage for threads, messages, workflows, traces, and more with connection pooling and transaction support.

## Installation

```bash
npm install @mastra/mysql
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { Mastra } from '@mastra/core';
import { MySQLStore } from '@mastra/mysql';

export const mastra = new Mastra({
  storage: new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  }),
});
```

## Documentation

- [MySQL integration guide](https://mastra.ai/integrations/databases/mysql)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/mysql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
