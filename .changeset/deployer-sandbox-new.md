---
'@mastra/deployer-sandbox': minor
---

New package: deploy a full Mastra server (including Studio) into any workspace sandbox that supports networking, and get a live public URL in seconds. Works with `@mastra/vercel`, `@mastra/e2b`, and `@mastra/daytona` sandboxes. Built for ephemeral environments: instant previews, PR/CI smoke deploys, agent-built app verification, and multi-tenant untrusted instances.

**Deploy from your Mastra config**

```typescript
import { Mastra } from '@mastra/core/mastra';
import { SandboxDeployer } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

export const mastra = new Mastra({
  deployer: new SandboxDeployer({
    sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
  }),
});
```

Then run `mastra build` — it bundles the project and deploys it into the sandbox in one step. Redeploys reuse the same sandbox and skip dependency installs when the install inputs (`package.json`, bundled lockfiles, and the install command) are unchanged.

**Manage the deployment**

The sandbox name is the identity — `getDeployment()` retrieves the deployment from any process or codebase, without importing the Mastra project:

```typescript
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { VercelSandbox } from '@mastra/vercel';

const dep = await getDeployment({
  sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
}); // never wakes a stopped sandbox
await dep.stop(); // snapshot-stop (resumable)
await dep.destroy(); // permanent delete
```

**Deploy programmatically (CI / agents)**

```typescript
import { deployToSandbox } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const sandbox = new VercelSandbox({ sandboxName: 'ci-preview', ports: [4111] });
const deployment = await deployToSandbox({ sandbox, dir: '.mastra/output' });
console.info(deployment.url);
```

**Resolve and route at runtime**

The server-only `@mastra/deployer-sandbox/client` export includes `getDeployment()` to resolve the current URL and manage the deployment (`stop()`, `destroy()`, `logs()`, with optional wake-on-demand), plus `createSandboxHandler()` and `createSandboxProxy()` helpers to serve a sandbox behind a stable URL on your own domain.
