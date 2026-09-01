# @mastra/s3

S3-compatible filesystem provider for Mastra workspaces (AWS S3, Cloudflare R2, MinIO). Use `@mastra/s3` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/s3
```

## Usage

```typescript
import { S3Filesystem } from '@mastra/s3';

// SDK discovers credentials from the environment
const filesystem = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
});
```

## Documentation

- [@mastra/s3 documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/s3/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
