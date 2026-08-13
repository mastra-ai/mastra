---
'@mastra/code-sdk': minor
---

Add a `createSaveWorkflowTool` factory with an optional deny-only authorization hook that receives the native request context and a detached workflow definition.

```ts
import { createSaveWorkflowTool } from '@mastra/code-sdk';

const saveWorkflowTool = createSaveWorkflowTool({
  authorize: ({ requestContext }) => {
    if (requestContext.get('role') !== 'workflow-author') {
      throw new Error('Workflow save denied');
    }
  },
});
```

Throwing from `authorize` rejects the save before Mastra validates, persists, or registers the workflow.
