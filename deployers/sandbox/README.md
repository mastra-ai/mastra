# @mastra/deployer-sandbox

Deploy a full Mastra server or a non-HTTP worker into a workspace sandbox.

Server deployments work with any `WorkspaceSandbox` provider that implements `executeCommand` and `networking`. Worker deployments require only `executeCommand`; they do not allocate ports, ingress, public URLs, or HTTP health checks. Positioning: **ephemeral environments** — instant previews, PR/CI smoke deploys, isolated jobs, agent-built-app verification, and multi-tenant untrusted instances. Not production hosting.

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

## Non-HTTP workers and custom commands

Deploy a prebuilt worker artifact without requiring networking. The command, arguments, working directory, and install command are trusted developer-authored inputs. The deployer preserves the artifact layout rather than assuming a Mastra-specific entrypoint or process protocol.

```typescript
import { deployWorkerToSandbox } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const worker = await deployWorkerToSandbox({
  sandbox: new VercelSandbox({ sandboxName: 'experiment-worker' }),
  dir: '.mastra/experiment-worker',
  command: 'node',
  args: ['index.mjs'],
  env: { JOB_ID: 'job-123' },
  startupTimeoutMs: 10_000,
  executionTimeoutMs: 15 * 60_000,
  terminationGraceMs: 5_000,
});

console.log(await worker.status());
console.log(await worker.logs());
await worker.cancel();
```

Dependency installs are cached using the artifact's `package.json`, supported lockfiles, and install command. `stop()` snapshot-stops the provider sandbox; after waking it through the provider, `relaunch()` starts the recorded command only when it is not already running. `destroy()` permanently deletes the sandbox.

Pass `wake: true` to resume a stopped server sandbox before returning — useful in a route handler that fronts the sandbox. If the server isn't healthy after the resume (some providers restore the filesystem but not processes), the wake relaunches it:

```typescript
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { VercelSandbox } from '@mastra/vercel';

const sandbox = new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] });
const dep = await getDeployment({ sandbox, wake: true });
```

See the Mastra docs for lifecycle, routing tiers, and security notes.
