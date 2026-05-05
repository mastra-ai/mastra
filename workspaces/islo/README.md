# @mastra/islo

[islo.dev](https://islo.dev) sandbox provider for Mastra workspaces. Backed by [`@islo-labs/sdk`](https://www.npmjs.com/package/@islo-labs/sdk); commands stream stdout/stderr live by consuming the islo SSE exec endpoint directly.

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
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

`apiKey` falls back to the `ISLO_API_KEY` environment variable. `baseUrl` falls back to `ISLO_BASE_URL`, then `https://api.islo.dev`. The SDK exchanges the API key for a short-lived JWT and refreshes it automatically.

## Lifecycle

| WorkspaceSandbox method | islo SDK call |
|---|---|
| `start()` | `sandboxes.createSandbox` (or reconnects to an existing sandbox by name when one is already live) |
| `stop()` | `sandboxes.stopSandbox` (paused; sandbox record retained) |
| `destroy()` | `sandboxes.deleteSandbox` (only when this instance acquired the sandbox) |
| `executeCommand()` | direct SSE consumer on `POST /sandboxes/{name}/exec/stream` |

## Live streaming

`@islo-labs/sdk`'s generated `execInSandboxStream` decodes the SSE response body through a JSON unmarshaler — by the time you see bytes, the command is finished. To deliver true line-by-line output, `IsloSandbox.executeCommand` bypasses that wrapper and consumes the `/exec/stream` endpoint directly. Auth still flows through the SDK's `TokenProvider`, so token refresh and base URL stay consistent.

If the SDK later exposes a streaming iterator, the consumer in `src/sandbox/sse.ts` should be removed and the SDK call used instead.

## Reconnection

When you pass a `sandboxName` that already exists and is still live (not `deleted`/`failed`), `start()` reconnects to it instead of creating a new one. `destroy()` only deletes sandboxes the current instance acquired itself, so reconnecting to an existing sandbox does not destroy it on shutdown.

## Configuration

| Option | Description | Default |
|---|---|---|
| `sandboxName` | Sandbox name (path segment) | `mastra-<random>` |
| `image` | Container image | islo tenant default |
| `workdir` | Working directory relative to `/workspace` | islo image default |
| `gatewayProfile` | Gateway profile name or id | tenant default |
| `env` | Environment variables for sandbox creation | `{}` |
| `apiKey` | islo API key (`ak_...`) | `ISLO_API_KEY` env var |
| `baseUrl` | API base URL | `ISLO_BASE_URL` or `https://api.islo.dev` |
| `timeout` | Default per-command timeout (ms) | `300000` |
| `metadata` | Sandbox-create metadata | `{}` |

## License

Apache-2.0
