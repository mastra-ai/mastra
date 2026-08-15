# @mastra/cloudflare-sandbox

Cloudflare Sandbox provider for Mastra workspaces, using a deployed [Cloudflare Sandbox Bridge](https://developers.cloudflare.com/sandbox/bridge/).

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
  apiToken: process.env.CLOUDFLARE_SANDBOX_BRIDGE_TOKEN,
});

const workspace = new Workspace({ sandbox });
```

The Bridge Worker must expose Cloudflare's standard `/sandboxes` HTTP API. Files written through `writeFiles()` must be under `/workspace`; relative paths are resolved there automatically.

Pass `sandboxId` to reconnect to an existing remote sandbox. Calling `stop()` preserves the remote sandbox because the Bridge API has no suspend operation. Calling `destroy()` deletes it.
