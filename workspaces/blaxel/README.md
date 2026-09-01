# @mastra/blaxel

Blaxel cloud sandbox provider for Mastra workspaces. Use `@mastra/blaxel` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/blaxel
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';
import { BlaxelSandbox } from '@mastra/blaxel';

const workspace = new Workspace({
  mounts: {
    '/data': new GCSFilesystem({
      bucket: 'my-bucket',
      serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
    }),
  },
  sandbox: new BlaxelSandbox(),
});
```

## Documentation

- [@mastra/blaxel documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/blaxel/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
