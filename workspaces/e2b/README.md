# @mastra/e2b

E2B cloud sandbox provider for Mastra workspaces. Provides secure, isolated code execution environments with support for mounting cloud storage.

## Installation

```bash
npm install @mastra/e2b
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  sandbox: new E2BSandbox({
    apiKey: 'my-api-key', // falls back to E2B_API_KEY env var
    timeout: 60_000, // 60 second timeout (default: 5 minutes)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

### Mounting Cloud Storage

E2B sandboxes can mount S3 or GCS filesystems, making cloud storage accessible as a local directory inside the sandbox:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';
import { E2BSandbox } from '@mastra/e2b';

const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }),
  },
  sandbox: new E2BSandbox(),
});
```

### Custom Templates

For advanced use cases, you can use custom E2B templates:

```typescript
const workspace = new Workspace({
  sandbox: new E2BSandbox({
    template: 'my-custom-template',
  }),
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
