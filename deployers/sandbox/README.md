# @mastra/deployer-sandbox

Deploy a full Mastra server or a non-HTTP worker into a workspace sandbox. It is intended for ephemeral previews, CI smoke deployments, isolated jobs, agent-built application verification, and untrusted tenant environments rather than permanent production hosting.

## Installation

```bash
npm install @mastra/deployer-sandbox
```

Install a workspace sandbox provider separately. The examples below use `@mastra/vercel`.

## Usage

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { SandboxDeployer } from '@mastra/deployer-sandbox';
import { VercelSandbox } from '@mastra/vercel';

const deployer = new SandboxDeployer({
  sandbox: new VercelSandbox({
    sandboxName: 'my-preview',
    timeout: 2_400_000,
    ports: [4111],
  }),
});

export const mastra = new Mastra({ deployer });
```

Running `mastra build` bundles the project and deploys it into the sandbox, then prints the API and Studio URLs.

## Documentation

Server deployments require a `WorkspaceSandbox` implementation with command execution and networking support. The sandbox name is the deployment identity, so subsequent processes can reconnect to the same deployment with the server-only `@mastra/deployer-sandbox/client` export:

```typescript
import { getDeployment } from '@mastra/deployer-sandbox/client';
import { VercelSandbox } from '@mastra/vercel';

const deployment = await getDeployment({
  sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
});

console.log(deployment.status, deployment.url);
await deployment.stop(); // Resumable snapshot stop
await deployment.destroy(); // Permanent deletion
```

Use `deployToSandbox()` for one-shot programmatic deployments of a prebuilt `.mastra/output` directory. Pass `wake: true` to `getDeployment()` when a stopped server should be resumed and health-checked before it is returned.

The package also supports non-HTTP workers through `deployWorkerToSandbox()`. Workers only require command execution and can receive bounded input through stdin or a staged file. Their handles expose status checks, separate offset-based stdout and stderr reads, cancellation, snapshot stop, relaunch, and permanent destruction. `attachWorkerDeployment()` reconstructs a handle from persisted sandbox and execution IDs after a supervisor restart.

Dependency installation is serialized and cached from the artifact's package manifest and lockfile. Worker cancellation sends TERM before KILL when necessary, while server health checks surface startup logs when a deployment fails to become ready.

- [Sandbox deployment documentation](https://mastra.ai/docs/deployment/sandbox)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/sandbox/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
