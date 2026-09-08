# @mastra/files-sdk

Unified storage filesystem provider for Mastra workspaces, powered by [FilesSDK](https://files-sdk.dev). Works with any FilesSDK adapter — S3, Cloudflare R2, Google Cloud Storage, Azure Blob, Vercel Blob, local filesystem, and more.

## Installation

```bash
npm install @mastra/files-sdk
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { FilesSDKFilesystem } from '@mastra/files-sdk';
import { Files } from 'files-sdk';
import { s3 } from 'files-sdk/s3';

const files = new Files({
  adapter: s3({
    bucket: 'my-bucket',
    region: 'us-east-1',
  }),
});

const workspace = new Workspace({
  filesystem: new FilesSDKFilesystem({ files }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [Vercel Files integration guide](https://mastra.ai/integrations/file-storage/vercel-files)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/files-sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
