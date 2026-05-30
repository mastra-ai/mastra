---
'@mastra/vercel': minor
---

Added `VercelMicroVMSandbox`, a new workspace sandbox provider backed by the [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) ephemeral Firecracker MicroVM product (`@vercel/sandbox`). It provides a persistent in-session filesystem, `sudo` access, exposed ports, command execution, and background processes via the process manager. This is distinct from the existing `VercelSandbox`, which runs commands as stateless Vercel serverless Functions and is unchanged. Also exports `VercelMicroVMProcessManager` and the `vercelMicroVMSandboxProvider` editor descriptor (provider id `vercel-microvm`). Closes #16704.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { VercelMicroVMSandbox } from '@mastra/vercel';

const workspace = new Workspace({
  sandbox: new VercelMicroVMSandbox({
    runtime: 'node24',
    timeout: 600_000,
    ports: [3000],
  }),
});

await workspace.init();
const result = await workspace.sandbox.executeCommand('node', ['--version']);
```
