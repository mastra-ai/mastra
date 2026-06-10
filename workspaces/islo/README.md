# @mastra/islo

[islo.dev](https://islo.dev) sandbox provider for Mastra workspaces. Backed by [`@islo-labs/sdk`](https://www.npmjs.com/package/@islo-labs/sdk); foreground commands stream stdout/stderr live by consuming the islo SSE exec endpoint directly.

## Installation

```bash
npm install @mastra/islo
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { IsloSandbox } from '@mastra/islo';

const workspace = new Workspace({
  sandbox: new IsloSandbox({
    apiKey: process.env.ISLO_API_KEY, // also read from ISLO_API_KEY env var
    image: 'docker.io/library/ubuntu:24.04',
    workdir: 'my-project',
    timeout: 60_000,
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: '__GATEWAY_ANTHROPIC_MODEL_OPUS__',
  workspace,
});
```

`apiKey` falls back to the `ISLO_API_KEY` environment variable. `controlUrl` falls back to `ISLO_CONTROL_URL`, then `https://api.islo.dev`. `computeUrl` falls back to `ISLO_COMPUTE_URL`, then `https://ca.compute.islo.dev`. Token exchange happens on the control API; sandbox lifecycle and exec calls happen on the compute API.

## Studio provider

Register the provider with `MastraEditor` to make Islo available for UI-driven workspace configuration:

```typescript
import { MastraEditor } from '@mastra/editor';
import { isloSandboxProvider } from '@mastra/islo';

const editor = new MastraEditor({
  sandboxes: {
    [isloSandboxProvider.id]: isloSandboxProvider,
  },
});
```

## Lifecycle

| WorkspaceSandbox method | islo SDK call |
|---|---|
| `start()` | `sandboxes.createSandbox` (or reconnects to an existing sandbox by name when one is already live) |
| `stop()` | `sandboxes.pauseSandbox` (paused; sandbox record retained) |
| `destroy()` | `sandboxes.deleteSandbox` (unless `deleteOnDestroy: false`) |
| `executeCommand()` | direct SSE consumer on `POST /sandboxes/{name}/exec/stream` |

## Live streaming

`IsloSandbox.executeCommand` consumes the compute API's `/exec/stream` endpoint directly so callers receive stdout/stderr deltas as they arrive. Auth still flows through the SDK's `TokenProvider`, so token refresh stays consistent.

If the SDK later exposes a streaming iterator, the consumer in `src/sandbox/sse.ts` should be removed and the SDK call used instead.

## Reconnection

When you pass a `sandboxName` that already exists and is still live, `start()` reconnects to it instead of creating a new one. Paused sandboxes are resumed. Stopped or failed sandboxes cannot be resumed; delete them or choose a new `sandboxName`. `destroy()` deletes the sandbox record by default, including reconnected sandboxes. Set `deleteOnDestroy: false` to keep the record.

## Process Support

`@mastra/islo` v1 supports foreground command execution only. It does not expose `sandbox.processes`, so Mastra background process tools, `get_process_output`, `kill_process`, and LSP process support are unavailable until Islo exposes a durable process/session contract with stable IDs, output history, status, and kill semantics.

## Configuration

| Option | Description | Default |
|---|---|---|
| `sandboxName` | Sandbox name (path segment) | `mastra-<random>` |
| `image` | Container image | islo tenant default |
| `workdir` | Working directory relative to `/workspace` | islo image default |
| `gatewayProfile` | Gateway profile name or id | tenant default |
| `env` | Environment variables for sandbox creation | `{}` |
| `apiKey` | islo API key (`ak_...`) | `ISLO_API_KEY` env var |
| `controlUrl` | Control API URL for token exchange | `ISLO_CONTROL_URL` or `https://api.islo.dev` |
| `computeUrl` | Compute API URL for sandbox operations | `ISLO_COMPUTE_URL` or `https://ca.compute.islo.dev` |
| `deleteOnDestroy` | Delete sandbox record during `destroy()` | `true` |
| `timeout` | Default per-command timeout (ms) | `300000` |
| `metadata` | Sandbox-create metadata | `{}` |

## License

Apache-2.0
