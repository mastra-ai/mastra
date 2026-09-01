# @mastra/gcs

Google Cloud Storage filesystem provider for Mastra workspaces. Use `@mastra/gcs` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/gcs
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  mounts: {
    '/my-bucket': new GCSFilesystem({
      bucket: 'my-gcs-bucket',
      projectId: 'my-project-id',
      credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY),
    }),
  },
  sandbox: new E2BSandbox(),
});
```

## Documentation

- [@mastra/gcs documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/gcs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
