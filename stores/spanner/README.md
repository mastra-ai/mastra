# @mastra/spanner

Google Cloud Spanner provider for Mastra - db storage capabilities (GoogleSQL dialect). Use `@mastra/spanner` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/spanner
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { SpannerStore } from '@mastra/spanner';

const store = new SpannerStore({
  id: 'spanner-storage',
  projectId: 'my-gcp-project',
  instanceId: 'my-instance',
  databaseId: 'mastra',
});
```

## Documentation

- [@mastra/spanner documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/spanner/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
