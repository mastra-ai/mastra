# @mastra/azure

Azure provider for Mastra - includes Blob Storage workspace filesystem. Use `@mastra/azure` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/azure
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { AzureBlobStore } from '@mastra/azure/blob';

const blobs = new AzureBlobStore({
  container: 'my-skill-blobs',
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
});
```

## Documentation

- [@mastra/azure documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/azure/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
