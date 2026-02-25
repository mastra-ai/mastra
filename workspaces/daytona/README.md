# @mastra/daytona

Daytona cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Daytona](https://www.daytona.io/) sandboxes. Supports multiple runtimes, resource configuration, volumes, snapshots, streaming output, and sandbox reconnection.

## Install

```bash
pnpm add @mastra/daytona @mastra/core
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
  resources: { cpu: 2, memory: 4, disk: 4 },
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

## Direct SDK Access

Access the underlying Daytona `Sandbox` instance for filesystem, git, and other operations not exposed through WorkspaceSandbox:

```typescript
const daytonaSandbox = sandbox.instance;

await daytonaSandbox.fs.uploadFile(Buffer.from('data'), '/tmp/file.txt');

await daytonaSandbox.git.clone('https://github.com/org/repo', '/workspace/repo');
```

## License

Apache-2.0
