# @mastra/gcs

Google Cloud Storage filesystem provider for Mastra workspaces.

## Installation

```bash
npm install @mastra/gcs
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';

const workspace = new Workspace({
  filesystem: new GCSFilesystem({
    bucket: 'my-gcs-bucket',
    // Uses Application Default Credentials by default
    // Or provide a service account key:
    serviceAccountKey: process.env.GCS_SERVICE_ACCOUNT_KEY,
  }),
});

await workspace.init();

// Read and write files
await workspace.writeFile('/data.json', JSON.stringify({ hello: 'world' }));
const content = await workspace.readFile('/data.json', { encoding: 'utf-8' });
```

### With E2B Sandbox Mounting

When used with `@mastra/e2b`, GCS filesystems can be mounted into E2B sandboxes via gcsfuse:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { GCSFilesystem } from '@mastra/gcs';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  filesystem: new GCSFilesystem({
    bucket: 'my-gcs-bucket',
  }),
  sandbox: new E2BSandbox(),
});

await workspace.init();

// Mount the GCS bucket into the sandbox at /mnt/data
await workspace.sandbox.mount(workspace.filesystem, '/mnt/data');
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspaces).

## License

Apache-2.0
