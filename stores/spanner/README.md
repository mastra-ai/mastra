# @mastra/spanner

Persist Mastra data in Google Cloud Spanner with strong consistency, GoogleSQL schemas, emulator support, initialization, and direct database access.

## Installation

```bash
npm install @mastra/spanner
```

## Usage

### Connecting to a managed Cloud Spanner database

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

- [Google Cloud Spanner](https://mastra.ai/integrations/databases/spanner)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/spanner/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
