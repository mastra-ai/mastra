---
'@mastra/vercel': minor
---

Added Vercel sandbox provider powered by `@vercel/sandbox` microVMs. Provides ephemeral Linux environments with persistent filesystem, real shell access, and background process support via Firecracker VMs.

**Usage:**

```typescript
import { VercelSandbox } from '@mastra/vercel';
import { Workspace } from '@mastra/core/workspace';

const workspace = new Workspace({
  sandbox: new VercelSandbox({
    runtime: 'node24',
    vcpus: 2,
    timeout: 300_000,
  }),
});
```
