---
'@mastra/render': minor
---

Added Render Sandboxes for Mastra agent workspaces, including command execution, file transfers, snapshots and ownership-aware cleanup.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { RenderSandbox } from '@mastra/render';

const sandbox = new RenderSandbox();
const workspace = new Workspace({ sandbox });
try {
  await workspace.init();
  const result = await sandbox.executeCommand('printf hello');
  console.log(result.stdout);
} finally {
  await workspace.destroy();
}
```
