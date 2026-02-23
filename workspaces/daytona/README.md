# @mastra/daytona

Daytona cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Daytona](https://www.daytona.io/) sandboxes. Supports multiple runtimes, resource configuration, volumes, and snapshots.

## Install

```bash
pnpm add @mastra/daytona @mastra/core
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 60000,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

## Configuration

| Option                | Type      | Default               | Description                    |
| --------------------- | --------- | --------------------- | ------------------------------ |
| `id`                  | `string`  | auto-generated        | Sandbox identifier             |
| `apiKey`              | `string`  | `DAYTONA_API_KEY` env | API key                        |
| `apiUrl`              | `string`  | `DAYTONA_API_URL` env | API endpoint                   |
| `target`              | `string`  | `DAYTONA_TARGET` env  | Runner region                  |
| `timeout`             | `number`  | `300000`              | Default execution timeout (ms) |
| `language`            | `string`  | `'typescript'`        | Runtime language               |
| `resources`           | `object`  | SDK defaults          | `{ cpu, memory, disk }`        |
| `env`                 | `object`  | `{}`                  | Environment variables          |
| `labels`              | `object`  | `{}`                  | Custom metadata labels         |
| `snapshot`            | `string`  | —                     | Pre-built snapshot ID          |
| `ephemeral`           | `boolean` | `false`               | Auto-delete on stop            |
| `autoStopInterval`    | `number`  | `15`                  | Minutes before auto-stop       |
| `autoArchiveInterval` | `number`  | —                     | Minutes before archiving       |
| `autoDeleteInterval`  | `number`  | —                     | Minutes before auto-delete     |
| `volumes`             | `array`   | —                     | `[{ volumeId, mountPath }]`    |
| `image`               | `string`  | —                     | Docker image for sandbox creation. Triggers image-based creation when set. Can be combined with `resources`. Ignored when `snapshot` is set. |
| `name`                | `string`  | —                     | Sandbox display name           |
| `user`                | `string`  | —                     | OS user to run commands as     |
| `public`              | `boolean` | —                     | Make port previews public      |
| `networkBlockAll`     | `boolean` | —                     | Block all network access       |
| `networkAllowList`    | `string`  | —                     | Comma-separated allowed hosts  |

## Direct SDK Access

Access the underlying Daytona `Sandbox` instance for filesystem, git, and LSP operations not exposed through WorkspaceSandbox:

```typescript
const daytonaSandbox = sandbox.instance;
await daytonaSandbox.fs.uploadFile(Buffer.from('data'), '/tmp/file.txt');
```

## License

Apache-2.0
