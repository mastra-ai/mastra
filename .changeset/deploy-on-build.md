---
'@mastra/core': minor
'mastra': minor
---

`mastra build` now deploys in one step for push-style deployers. Deployers can opt in with the new `deployOnBuild` flag on the deployer contract, and the build runs their `deploy()` right after bundling. `SandboxDeployer` from `@mastra/deployer-sandbox` opts in, so configuring it means `mastra build` bundles your project, deploys it into the sandbox, and prints the live URL. Existing platform deployers are unchanged.

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

```bash
mastra build # bundles AND deploys — prints the live URL
```
