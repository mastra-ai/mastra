---
'@mastra/cua': minor
---

Added Cua Cloud Fleet desktops for Mastra computer use.

Attach a Linux desktop from an existing Fleet pool to a workspace. Each provider owns an independent claim; call `destroy()` to release it. Shell execution, pause/resume, and reconnecting by ID are not supported.

```ts
import { Workspace } from '@mastra/core/workspace';
import { CuaFleetSandbox } from '@mastra/cua';

const sandbox = new CuaFleetSandbox({
  id: 'desktop-session',
  poolName: 'existing-linux-pool',
  clientId: process.env.CUA_CLIENT_ID!,
  clientSecret: process.env.CUA_CLIENT_SECRET!,
});
const workspace = new Workspace({ sandbox });

try {
  await workspace.init();
  await sandbox.computer.screenshot();
} finally {
  await workspace.destroy();
}
```
