# @mastra/daytona

Daytona cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Daytona](https://www.daytona.io/) sandboxes. Supports multiple runtimes, resource configuration, volumes, snapshots, streaming output, sandbox reconnection, and filesystem mounting (S3, GCS, Azure Blob).

## Install

```bash
pnpm add @mastra/daytona @mastra/core

# For filesystem mounting (optional)
pnpm add @mastra/s3 @mastra/gcs @mastra/azure
```

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 60_000,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

### Snapshot

Use a pre-built snapshot to skip environment setup time:

```typescript
const sandbox = new DaytonaSandbox({
  snapshot: 'my-snapshot-id',
  timeout: 60_000,
});
```

### Custom image with resources

Use a custom Docker image with specific resource allocation:

```typescript
const sandbox = new DaytonaSandbox({
  image: 'node:20-slim',
  resources: { cpu: 2, memory: 4, disk: 6 },
  language: 'typescript',
});
```

### Ephemeral sandbox

For one-shot tasks — sandbox is deleted immediately on stop:

```typescript
const sandbox = new DaytonaSandbox({
  ephemeral: true,
  language: 'python',
});
```

### Streaming output

Stream command output in real time via callbacks:

```typescript
await sandbox.executeCommand('bash', ['-c', 'for i in 1 2 3; do echo "line $i"; sleep 1; done'], {
  onStdout: chunk => process.stdout.write(chunk),
  onStderr: chunk => process.stderr.write(chunk),
});
```

### Reconnection

Reconnect to an existing sandbox by providing the same `id`. The sandbox resumes with its files and state intact:

```typescript
const sandbox = new DaytonaSandbox({ id: 'my-persistent-sandbox' });

// First session
await sandbox._start();
await sandbox.executeCommand('sh', ['-c', 'echo "session 1" > /tmp/state.txt']);
await sandbox._stop();

// Later — reconnects to the same sandbox
const sandbox2 = new DaytonaSandbox({ id: 'my-persistent-sandbox' });
await sandbox2._start();
const result = await sandbox2.executeCommand('cat', ['/tmp/state.txt']);
console.log(result.stdout); // "session 1"
```

### Filesystem mounting

Mount S3, GCS, or Azure Blob containers as local directories inside the sandbox.

#### Via workspace mounts config

The simplest way — filesystems are mounted automatically when the sandbox starts:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';
import { GCSFilesystem } from '@mastra/gcs';
import { S3Filesystem } from '@mastra/s3';
import { AzureBlobFilesystem } from '@mastra/azure/blob';

const workspace = new Workspace({
  mounts: {
    '/s3-data': new S3Filesystem({
      bucket: process.env.S3_BUCKET!,
      region: 'auto',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT, // e.g. https://<account-id>.r2.cloudflarestorage.com
    }),
    '/gcs-data': new GCSFilesystem({
      bucket: process.env.GCS_BUCKET!,
      projectId: 'my-project-id',
      credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!),
    }),
    '/azure-data': new AzureBlobFilesystem({
      container: process.env.AZURE_STORAGE_CONTAINER!,
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
      prefix: 'workspace/data',
    }),
  },
  sandbox: new DaytonaSandbox({ language: 'python' }),
});
```

#### Via sandbox.mount()

Mount manually at any point after the sandbox has started:

#### S3

```typescript
import { DaytonaSandbox } from '@mastra/daytona';
import { S3Filesystem } from '@mastra/s3';

const sandbox = new DaytonaSandbox({ language: 'python' });
await sandbox._start();

await sandbox.mount(
  new S3Filesystem({
    bucket: process.env.S3_BUCKET!,
    region: 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  }),
  '/data',
);

// Files in the bucket are now accessible at /data
const result = await sandbox.executeCommand('ls', ['/data']);
console.log(result.stdout);

await sandbox._stop(); // Unmounts automatically before stopping
```

#### S3-compatible (Cloudflare R2, MinIO)

```typescript
import { S3Filesystem } from '@mastra/s3';

await sandbox.mount(
  new S3Filesystem({
    bucket: process.env.S3_BUCKET!,
    region: 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT, // e.g. https://<account-id>.r2.cloudflarestorage.com
  }),
  '/data',
);
```

#### GCS

```typescript
import { GCSFilesystem } from '@mastra/gcs';

await sandbox.mount(
  new GCSFilesystem({
    bucket: process.env.GCS_BUCKET!,
    projectId: 'my-project-id',
    credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY!),
  }),
  '/data',
);
```

#### Azure Blob

```typescript
import { AzureBlobFilesystem } from '@mastra/azure/blob';

await sandbox.mount(
  new AzureBlobFilesystem({
    container: process.env.AZURE_STORAGE_CONTAINER!,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    prefix: 'workspace/data',
  }),
  '/data',
);
```

### Network isolation

Restrict outbound network access:

```typescript
const sandbox = new DaytonaSandbox({
  networkBlockAll: true,
  networkAllowList: '10.0.0.0/8,192.168.0.0/16',
});
```

### With Agent

Wire a Daytona sandbox into a Mastra agent to give it code execution in an isolated sandbox:

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 120_000,
});

const workspace = new Workspace({ sandbox });

const agent = new Agent({
  id: 'code-agent',
  name: 'Code Agent',
  instructions: 'You are a coding assistant working in this workspace.',
  model: 'anthropic/claude-sonnet-4-6',
  workspace,
});

const response = await agent.generate('Print "Hello, world!" and show the current working directory.');

console.log(response.text);
// I'll run both commands simultaneously!
//
// Here are the results:
//
// 1. **Hello, world!** — Successfully printed the message.
// 2. **Current Working Directory** — `/home/daytona`
//
// Both commands ran in parallel and completed successfully!
```

## Configuration

| Option                | Type      | Default               | Description                                                                                                                                  |
| --------------------- | --------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | `string`  | auto-generated        | Sandbox identifier                                                                                                                           |
| `apiKey`              | `string`  | `DAYTONA_API_KEY` env | API key                                                                                                                                      |
| `apiUrl`              | `string`  | `DAYTONA_API_URL` env | API endpoint                                                                                                                                 |
| `target`              | `string`  | `DAYTONA_TARGET` env  | Runner region                                                                                                                                |
| `timeout`             | `number`  | `300000`              | Default execution timeout (ms)                                                                                                               |
| `language`            | `string`  | `'typescript'`        | Runtime language                                                                                                                             |
| `snapshot`            | `string`  | —                     | Pre-built snapshot ID. Takes precedence over `image`.                                                                                        |
| `image`               | `string`  | —                     | Docker image for sandbox creation. Triggers image-based creation when set. Can be combined with `resources`. Ignored when `snapshot` is set. |
| `resources`           | `object`  | SDK defaults          | `{ cpu, memory, disk }`. Only used with `image`.                                                                                             |
| `env`                 | `object`  | `{}`                  | Environment variables                                                                                                                        |
| `labels`              | `object`  | `{}`                  | Custom metadata labels                                                                                                                       |
| `name`                | `string`  | sandbox `id`          | Sandbox display name                                                                                                                         |
| `user`                | `string`  | `daytona`             | OS user to run commands as                                                                                                                   |
| `public`              | `boolean` | `false`               | Make port previews public                                                                                                                    |
| `ephemeral`           | `boolean` | `false`               | Delete sandbox immediately on stop                                                                                                           |
| `autoStopInterval`    | `number`  | `15`                  | Auto-stop interval in minutes (0 = disabled)                                                                                                 |
| `autoArchiveInterval` | `number`  | `7 days`              | Auto-archive interval in minutes (0 = 7 days)                                                                                                |
| `autoDeleteInterval`  | `number`  | `disabled`            | Auto-delete interval in minutes (negative = disabled, 0 = delete on stop)                                                                    |
| `volumes`             | `array`   | —                     | `[{ volumeId, mountPath }]`                                                                                                                  |
| `networkBlockAll`     | `boolean` | `false`               | Block all network access                                                                                                                     |
| `networkAllowList`    | `string`  | —                     | Comma-separated allowed CIDR addresses                                                                                                       |

## Mount Configuration

Pass `S3Filesystem`, `GCSFilesystem`, or `AzureBlobFilesystem` instances via the workspace `mounts` config or directly to `sandbox.mount()`.

### S3 environment variables

| Variable               | Description                       |
| ---------------------- | --------------------------------- |
| `S3_BUCKET`            | Bucket name                       |
| `S3_REGION`            | AWS region or `auto` for R2/MinIO |
| `S3_ACCESS_KEY_ID`     | Access key ID                     |
| `S3_SECRET_ACCESS_KEY` | Secret access key                 |
| `S3_ENDPOINT`          | Endpoint URL (S3-compatible only) |

### GCS environment variables

| Variable                  | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `GCS_BUCKET`              | Bucket name                                             |
| `GCS_SERVICE_ACCOUNT_KEY` | Service account key JSON (full JSON string, not a path) |

### Azure Blob environment variables

| Variable                          | Description               |
| --------------------------------- | ------------------------- |
| `AZURE_STORAGE_CONTAINER`         | Container name            |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage connection string |

### Reducing cold start latency with a snapshot

By default, `s3fs`, `gcsfuse`, and `blobfuse2` are installed at first mount, which adds startup time. To eliminate this, prebake them into a Daytona snapshot and pass the snapshot name via the `snapshot` option.

Create the snapshot once:

```typescript
import { Daytona, Image } from '@daytonaio/sdk';

const template = Image.base('daytonaio/sandbox')
  .runCommands('sudo apt-get update -qq')
  .runCommands('sudo apt-get install -y s3fs')
  // gcsfuse requires the Google Cloud apt repository
  .runCommands(
    'sudo mkdir -p /etc/apt/keyrings && ' +
      'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg -o /tmp/gcsfuse-key.gpg && ' +
      'sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/gcsfuse.gpg /tmp/gcsfuse-key.gpg && ' +
      // Use gcsfuse-jammy for Ubuntu, gcsfuse-bookworm for Debian
      'echo "deb [signed-by=/etc/apt/keyrings/gcsfuse.gpg] https://packages.cloud.google.com/apt gcsfuse-jammy main" | sudo tee /etc/apt/sources.list.d/gcsfuse.list',
  )
  .runCommands('sudo apt-get update -qq && sudo apt-get install -y gcsfuse');

const daytona = new Daytona();
await daytona.snapshot.create(
  {
    name: 'cloud-fs-mounting',
    image: template,
  },
  { onLogs: console.log },
);
```

If you use Azure Blob mounts, also pre-install `blobfuse2` in the snapshot using Azure's supported package for your base image. See Azure's [BlobFuse2 installation guide](https://learn.microsoft.com/en-us/azure/storage/blobs/blobfuse2-how-to-deploy) for supported install options.

Then use the snapshot name in your sandbox config:

```typescript
const workspace = new Workspace({
  mounts: {
    '/s3-data': new S3Filesystem({
      /* ... */
    }),
    '/gcs-data': new GCSFilesystem({
      /* ... */
    }),
  },
  sandbox: new DaytonaSandbox({ snapshot: 'cloud-fs-mounting' }),
});
```

## Direct SDK Access

Access the underlying Daytona `Sandbox` instance for filesystem, git, and other operations not exposed through WorkspaceSandbox:

```typescript
const daytonaSandbox = sandbox.instance;

await daytonaSandbox.fs.uploadFile(Buffer.from('data'), '/tmp/file.txt');

await daytonaSandbox.git.clone('https://github.com/org/repo', '/workspace/repo');
```

## License

Apache-2.0
