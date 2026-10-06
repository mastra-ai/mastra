# @mastra/cloudflare-sandbox

Cloudflare Sandbox provider for Mastra workspaces. It talks to a deployed [Cloudflare Sandbox Bridge Worker](https://developers.cloudflare.com/sandbox/bridge/) over the documented [`/v1/sandbox` HTTP API](https://developers.cloudflare.com/sandbox/bridge/http-api/).

## Installation

```bash
npm install @mastra/cloudflare-sandbox
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

## Durable files

Mount a private R2 Worker binding without passing storage keys into the container:

```typescript
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  sandbox,
  mounts: {
    '/workspace': new S3Filesystem({
      bucket: 'WORKSPACE_FILES', // The R2 binding name in the Bridge Worker.
      region: 'auto',
      prefix: 'private-chat/',
    }),
  },
});
```

Without an endpoint or credentials, `region: 'auto'` selects the Bridge Worker's R2 binding. Explicit S3 endpoints and AWS regions still work. Region `auto` with credentials requires an explicit endpoint.

Before commands, reads, writes, archive or restore, the provider checks required mounts and reconnects them after container sleep. A failed or incomplete check, failed reconnect or unfinished mount rejects the operation. It never falls through to temporary disk. Paths without a bucket mount remain temporary.

## Documentation

- [Cloudflare Sandbox integration guide](https://mastra.ai/integrations/sandboxes/cloudflare-sandbox)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/cloudflare-sandbox/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
