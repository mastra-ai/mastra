# @mastra/s3

S3-compatible filesystem provider for Mastra workspaces. Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, and other S3-compatible storage services.

## Installation

```bash
npm install @mastra/s3
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  filesystem: new S3Filesystem({
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [Amazon S3 integration guide](https://mastra.ai/integrations/file-storage/amazon-s3)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/s3/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
