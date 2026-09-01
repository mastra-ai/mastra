# @mastra/clickhouse

Clickhouse provider for Mastra - includes db storage capabilities. Use `@mastra/clickhouse` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/clickhouse
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { ClickhouseStore } from '@mastra/clickhouse';

const store = new ClickhouseStore({
  id: 'clickhouse-storage',
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USERNAME!,
  password: process.env.CLICKHOUSE_PASSWORD!,
});
```

## Documentation

- [@mastra/clickhouse documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/clickhouse/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
