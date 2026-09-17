# @mastra/azure

Store Mastra workspace files in Azure Blob Storage using account keys, SAS tokens, or DefaultAzureCredential, with container and mount configuration.

## Installation

```bash
npm install @mastra/azure
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { AzureBlobFilesystem } from '@mastra/azure/blob';

const workspace = new Workspace({
  filesystem: new AzureBlobFilesystem({
    container: 'my-container',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [Azure Blob](https://mastra.ai/integrations/file-storage/azure-blob)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/azure/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
