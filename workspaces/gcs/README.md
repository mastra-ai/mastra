# @mastra/gcs

Google Cloud Storage filesystem provider for Mastra workspaces.

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

### With E2B Sandbox

When used with `@mastra/e2b`, GCS filesystems can be mounted into E2B sandboxes via gcsfuse:

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

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
