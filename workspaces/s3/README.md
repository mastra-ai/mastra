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

### Cloudflare R2

```typescript
const workspace = new Workspace({
  filesystem: new S3Filesystem({
    bucket: 'my-r2-bucket',
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  }),
});
```

### With E2B Sandbox

When used with `@mastra/e2b`, S3 filesystems can be mounted into E2B sandboxes via s3fs-fuse:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  mounts: {
    '/my-bucket': new S3Filesystem({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }),
  },
  sandbox: new E2BSandbox(),
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
