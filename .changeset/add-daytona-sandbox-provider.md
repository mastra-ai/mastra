---
'@mastra/daytona': minor
---

Add DaytonaSandbox workspace provider — Daytona cloud sandbox integration for Mastra workspaces, implementing the WorkspaceSandbox interface with support for command execution, environment variables, resource configuration, snapshots, and Daytona volumes.

**Basic usage**

```ts
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  id: 'my-sandbox',
  env: { NODE_ENV: 'production' },
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```
