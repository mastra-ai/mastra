# @mastra/files-sdk

FilesSDK filesystem provider for Mastra workspaces — unified storage across S3, R2, GCS, Azure, Vercel Blob, and more. Use `@mastra/files-sdk` to connect this provider to a Mastra application.

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
  model: 'openai/gpt-5.6-sol',
  workspace,
});
```

## Documentation

- [@mastra/files-sdk documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/files-sdk/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
