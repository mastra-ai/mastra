# @mastra/upstash-box

[Upstash Box](https://upstash.com/docs/box) cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Box is a managed cloud sandbox for AI coding agents. This package adapts it to
the Mastra `WorkspaceSandbox` interface so agents can run shell commands in an
isolated, disposable cloud environment.

## Installation

```bash
npm install @mastra/upstash-box
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { UpstashBoxSandbox } from '@mastra/upstash-box';

const sandbox = new UpstashBoxSandbox({
  runtime: 'node',
  size: 'small',
  // apiKey defaults to the UPSTASH_BOX_API_KEY env var
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['hello']);
console.log(result.stdout); // "hello"

await workspace.destroy();
```

### Reconnecting to an existing box

```typescript
const sandbox = new UpstashBoxSandbox({ boxId: 'box_abc123' });
```

After the first `start()`, the server-side box id is stored, so a `stop()`
(which pauses the box) followed by `start()` reconnects to the same box and
resumes it.

## Configuration

| Option          | Type                                | Default                  | Description                                                                |
| --------------- | ----------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `id`            | `string`                            | auto-generated           | Logical id for this sandbox instance (used as the box name on create).     |
| `boxId`         | `string`                            | —                        | Reconnect to an existing box by its server-side id.                        |
| `apiKey`        | `string`                            | `UPSTASH_BOX_API_KEY`    | Box API key.                                                               |
| `baseUrl`       | `string`                            | SDK default              | Box API base URL (`UPSTASH_BOX_BASE_URL` env var also honored by the SDK). |
| `runtime`       | `'node' \| 'python' \| ...`         | `'node'`                 | Runtime preinstalled in the box.                                           |
| `size`          | `'small' \| 'medium' \| 'large'`    | `'small'`                | Resource size of the box.                                                  |
| `keepAlive`     | `boolean`                           | `false`                  | Keep the box alive instead of idle-pausing. Keep-alive boxes can't pause.  |
| `env`           | `Record<string, string>`            | `{}`                     | Environment variables baked in at create time.                             |
| `workdir`       | `string`                            | —                        | Default working directory for spawned commands.                            |
| `networkPolicy` | `NetworkPolicy`                     | allow-all                | Outbound network access policy.                                            |
| `skills`        | `string[]`                          | —                        | GitHub `owner/repo` skills to install on the box.                          |
| `timeout`       | `number`                            | —                        | Default command timeout (ms) for spawns without their own; omit = unbounded (matches Daytona/Railway/E2B). |
| `requestTimeout`| `number`                            | `600_000`                | Request timeout (ms) for Box API calls.                                    |
| `instructions`  | `string \| (ctx) => string`         | —                        | Override `getInstructions()` output for agents.                            |

## Lifecycle

- **`start()`** — reconnects to a known box (`boxId`) and resumes it, or creates a new box.
- **`stop()`** — pauses the box (releases compute, preserves state). No-op for keep-alive boxes. The box id is retained for reconnect.
- **`destroy()`** — permanently deletes the box.

## Background processes

Box's `exec` API is request/response and blocks until a command finishes, so the
process manager runs each spawned process **detached** on the box (a small shell
harness started via `nohup`). `spawn()` returns immediately with the process's
OS pid; `wait()` polls the box, streaming new stdout/stderr to the handle and
resolving when the process exits; `kill()` signals the pid.

```typescript
await sandbox._start()

const handle = await sandbox.processes.spawn('npm run dev', {
  onStdout: data => process.stdout.write(data),
})
// ... do other work while it runs ...
await handle.kill()
```

## Notes

- Background processes are supported via the detached-harness model above, so
  `spawn()` is non-blocking and long-running processes can be killed.
- stdout and stderr are captured separately (`result.stdout` / `result.stderr`).
- Output streaming is **poll-based** (default 400ms), so `onStdout`/`onStderr`
  callbacks fire in near-real-time rather than as a true byte stream.
- `sendStdin()` is not supported — Box does not expose a stdin channel on exec.

## Direct SDK access

Use the `box` accessor to reach Box features not surfaced through the
`WorkspaceSandbox` interface (files, git, snapshots, agents):

```typescript
await sandbox._start();
await sandbox.box.files.write({ path: 'hello.txt', content: 'hi' });
await sandbox.box.git.clone({ repo: 'owner/repo' });
```

## License

Apache-2.0
