# @mastra/deployer-sandbox

Deploy a full Mastra server or a non-HTTP worker into a workspace sandbox.

Server deployments work with any `WorkspaceSandbox` provider that implements `executeCommand` and `networking`. Worker deployments require only `executeCommand`; they do not allocate ports, ingress, public URLs, or HTTP health checks. Positioning: **ephemeral environments** — instant previews, PR/CI smoke deploys, isolated jobs, agent-built-app verification, and multi-tenant untrusted instances. Not production hosting.

## Installation

```bash
npm install @mastra/deployer-sandbox
```

## Usage

Choose a workspace sandbox provider and install its package. This example uses `@mastra/vercel` for ephemeral Vercel sandboxes.

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { SandboxDeployer } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const deployer = new SandboxDeployer({
  sandbox: new VercelSandbox({
    sandboxName: 'my-preview', // identity: redeploys resume this sandbox
    timeout: 2_400_000, // must stay under the plan's max sandbox lifetime (45 min on Pro)
    ports: [4111],
  }),
});

export const mastra = new Mastra({ deployer });
```

## Documentation

- [@mastra/deployer-sandbox documentation](https://mastra.ai/docs/deployment/sandbox)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/sandbox/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
