# @mastra/cloudflare-sandbox

Cloudflare Sandbox provider for Mastra workspaces. It talks to a deployed [Cloudflare Sandbox Bridge Worker](https://developers.cloudflare.com/sandbox/bridge/) over the documented [`/v1/sandbox` HTTP API](https://developers.cloudflare.com/sandbox/bridge/http-api/).

## Installation

```bash
pnpm add @mastra/cloudflare-sandbox
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { CloudflareSandbox } from '@mastra/cloudflare-sandbox';

const sandbox = new CloudflareSandbox({
  baseUrl: process.env.CLOUDFLARE_SANDBOX_BRIDGE_URL!,
  apiToken: process.env.CLOUDFLARE_SANDBOX_API_KEY,
});

const workspace = new Workspace({ sandbox });
```

`baseUrl` is the root URL of your bridge Worker, and `apiToken` is the value of the Worker's `SANDBOX_API_KEY` secret.

Commands run through `POST /v1/sandbox/:id/exec` as an `argv` array, so the bridge does the shell escaping. Files written through `writeFiles()` must resolve under `/workspace`; relative paths are resolved there automatically, and each file is sent as one `PUT /v1/sandbox/:id/file/*` request.

Pass `sandboxId` to reconnect to an existing remote sandbox. `stop()` preserves the remote sandbox because the bridge has no suspend operation. `destroy()` deletes it.

## Integration tests

The integration suite runs against a real bridge deployment:

```bash
CLOUDFLARE_SANDBOX_BRIDGE_URL=https://<worker>.workers.dev \
CLOUDFLARE_SANDBOX_API_KEY=<SANDBOX_API_KEY secret> \
  pnpm --filter @mastra/cloudflare-sandbox test
```

Without `CLOUDFLARE_SANDBOX_BRIDGE_URL` the suite skips.
