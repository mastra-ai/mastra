# @mastra/gcs

`@mastra/gcs` mounts a Google Cloud Storage bucket as the filesystem for a Mastra workspace. Use it when agents need durable, shared file access across processes or deployments instead of a local filesystem.

## Installation

```bash
npm install @mastra/gcs
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';

const workspace = new Workspace({
  filesystem: new GCSFilesystem({
    bucket: 'my-gcs-bucket',
    // Uses Application Default Credentials by default
    // Or provide a service account key:
    projectId: 'my-project-id',
    credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY),
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Documentation

- [Google Cloud Storage integration guide](https://mastra.ai/integrations/file-storage/google-cloud-storage)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/gcs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
