# @mastra/s3

S3-compatible filesystem provider for Mastra workspaces. Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, and other S3-compatible storage services.

## Installation

```bash
npm install @mastra/s3
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  filesystem: new S3Filesystem({
    bucket: 'my-bucket',
    region: 'us-east-1',
    // Uses AWS SDK credential chain by default
    // Or provide explicit credentials:
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

await workspace.init();

// Read and write files
await workspace.writeFile('/data.json', JSON.stringify({ hello: 'world' }));
const content = await workspace.readFile('/data.json', { encoding: 'utf-8' });
```

### Cloudflare R2

```typescript
const workspace = new Workspace({
  filesystem: new S3Filesystem({
    bucket: 'my-r2-bucket',
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  }),
});
```

### With E2B Sandbox Mounting

When used with `@mastra/e2b`, S3 filesystems can be mounted into E2B sandboxes via s3fs-fuse:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  filesystem: new S3Filesystem({
    bucket: 'my-bucket',
    region: 'us-east-1',
  }),
  sandbox: new E2BSandbox(),
});

await workspace.init();

// Mount the S3 bucket into the sandbox at /mnt/data
await workspace.sandbox.mount(workspace.filesystem, '/mnt/data');
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspaces).

## License

Apache-2.0
