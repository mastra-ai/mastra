# @mastra/blaxel

Blaxel cloud sandbox provider for Mastra workspaces. Provides secure, isolated code execution environments with support for mounting cloud storage (S3, GCS) via FUSE.

## Installation

```bash
npm install @mastra/blaxel
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { BlaxelSandbox } from '@mastra/blaxel';

const workspace = new Workspace({
  sandbox: new BlaxelSandbox({
    timeout: '5m', // sandbox TTL (default: 5 minutes)
    memory: 4096, // memory in MB (default: 4096)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

### Configuration Options

| Option     | Type                                  | Default                      | Description                                            |
| ---------- | ------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `id`       | `string`                              | auto-generated               | Unique identifier for the sandbox instance             |
| `image`    | `string`                              | `'blaxel/py-app:latest'`     | Docker image to use                                    |
| `memory`   | `number`                              | `4096`                       | Memory allocation in MB                                |
| `timeout`  | `string`                              | `'5m'`                       | Sandbox TTL as a duration string (e.g. `'5m'`, `'1h'`) |
| `env`      | `Record<string, string>`              | —                            | Environment variables to set in the sandbox            |
| `labels`   | `Record<string, string>`              | —                            | Custom labels for the sandbox                          |
| `runtimes` | `SandboxRuntime[]`                    | `['node', 'python', 'bash']` | Supported runtimes                                     |
| `ports`    | `Array<{ name?, target, protocol? }>` | —                            | Ports to expose from the sandbox                       |

### Mounting Cloud Storage

Blaxel sandboxes can mount S3 or GCS filesystems, making cloud storage accessible as a local directory inside the sandbox.

#### S3

```typescript
import { Workspace } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';
import { BlaxelSandbox } from '@mastra/blaxel';

const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }),
  },
  sandbox: new BlaxelSandbox(),
});
```

#### GCS

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

### Custom Images

For advanced use cases, you can specify a custom Docker image:

```typescript
const workspace = new Workspace({
  sandbox: new BlaxelSandbox({
    image: 'my-custom-image:latest',
  }),
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
