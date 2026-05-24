---
"@mastra/core": patch
---

Added Harness v1 workspace restore planning so callers can build ordered restore plans from workspace action journal entries for a session, turn, or file scope.

Example:

```ts
import { createWorkspaceRestorePlan } from '@mastra/core/harness/v1';

const plan = createWorkspaceRestorePlan({
  scope: { kind: 'session' },
  entries,
});
```
