---
'@mastra/core': patch
---

Fixed `requireApproval` on tools to accept a function in addition to a boolean. Previously, passing a function for `requireApproval` on a tool created with `createTool` was silently ignored and approval was never required.

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

createTool({
  id: 'delete-file',
  description: 'Delete a file',
  inputSchema: z.object({ path: z.string() }),
  // Now works: only require approval for paths outside /tmp
  requireApproval: input => !input.path.startsWith('/tmp/'),
  execute: async ({ context }) => {
    // ...
  },
});
```
