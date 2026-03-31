---
'@mastra/vercel': minor
---

Added Vercel serverless sandbox provider for executing commands as Vercel Functions. Deploys code as serverless functions and executes commands via HTTP invocation — providing globally-distributed, zero-infrastructure execution.

**Usage:**

```typescript
import { VercelSandbox } from '@mastra/vercel';
import { Workspace } from '@mastra/core/workspace';

const workspace = new Workspace({
  sandbox: new VercelSandbox({
    token: process.env.VERCEL_TOKEN,
  }),
});
```
