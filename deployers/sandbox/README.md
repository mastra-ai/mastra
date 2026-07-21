# @mastra/deployer-sandbox

Deploy a full Mastra server into any workspace sandbox that supports networking — and get a live public URL in seconds.

Works with any `WorkspaceSandbox` provider that implements the core `networking` capability (Vercel Sandbox, E2B, Daytona, ...). Positioning: **ephemeral environments** — instant previews, PR/CI smoke deploys, agent-built-app verification, multi-tenant untrusted instances. Not production hosting.

## Usage

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { SandboxDeployer } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const deployer = new SandboxDeployer({
  sandbox: new VercelSandbox({
    sandboxName: 'my-preview', // identity: redeploys resume this sandbox
    timeout: 3_600_000,
    ports: [4111],
  }),
});

export const mastra = new Mastra({
  // ...
  deployer,
});
```

```bash
mastra build
```

`mastra build` bundles the project and deploys it into the sandbox in one step, printing the live API and Studio URLs.

Manage the deployment afterward with `getDeployment()` from the server-only `client` export — the sandbox name is the identity, so this works from any process or codebase:

```typescript
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { VercelSandbox } from '@mastra/vercel';

const dep = await getDeployment({
  sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
}); // never wakes a stopped sandbox
console.log(dep.status, dep.url);
await dep.stop(); // snapshot-stop (resumable)
await dep.destroy(); // permanent delete
```

Provider tooling works too (for example `vercel sandbox ls|stop|rm`).

One-shot programmatic deploy (CI / agents), no bundler — takes a prebuilt output dir:

```typescript
import { deployToSandbox } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const sandbox = new VercelSandbox({ sandboxName: 'ci-preview', ports: [4111] });
const deployment = await deployToSandbox({ sandbox, dir: '.mastra/output', port: 4111 });
console.log(deployment.url);
```

Pass `wake: true` to resume a stopped sandbox before returning — useful in a route handler that fronts the sandbox. If the server isn't healthy after the resume (some providers restore the filesystem but not processes), the wake relaunches it:

```typescript
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { VercelSandbox } from '@mastra/vercel';

const sandbox = new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] });
const dep = await getDeployment({ sandbox, wake: true });
```

See the Mastra docs for lifecycle, routing tiers, and security notes.
