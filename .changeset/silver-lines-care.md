---
'@mastra/mainbrella': minor
---

Added Mainbrella sandboxes and filesystems for Mastra workspaces, with managed command streaming, stdin, cancellation, and generation-qualified reconnection and cleanup.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { MainbrellaFilesystem, MainbrellaSandbox } from '@mastra/mainbrella';

const sandbox = new MainbrellaSandbox({ catalogId: 'node', size: 'lite' });
const workspace = new Workspace({
  sandbox,
  filesystem: new MainbrellaFilesystem({ sandbox }),
});
```
