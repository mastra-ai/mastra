---
'@mastra/core': patch
---

Workflow lifecycle checks can read a run's status and execution generation
without transferring its full snapshot through native storage adapters. The
existing snapshot read remains the fallback for adapters without a compact
projection.

```ts
const executionState = await workflowsStorage.getWorkflowExecutionState({
  workflowName: 'my-workflow',
  runId: 'run-123',
});
// { status, executionGeneration? } | null
```
