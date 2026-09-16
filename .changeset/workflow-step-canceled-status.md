---
'@mastra/core': patch
---

Add `'canceled'` to the public workflow step-status contract. `StepResult`, `SerializedStepResult`, and the derived `WorkflowStepStatus` now include a `StepCanceled` variant, matching the `status: 'canceled'` results the runtime already emits and persists for canceled control-flow steps (e.g. `foreach` and loops). Typed consumers of `getWorkflowRunById()`, `WorkflowState.steps`, and lifecycle callback step results can now represent canceled steps without casts.

```ts
import type { WorkflowStepStatus } from '@mastra/core/workflows';

const run = await workflow.getWorkflowRunById(runId);
const step = run?.steps?.['process-items'];
if (step && !Array.isArray(step)) {
  const status: WorkflowStepStatus = step.status; // may now be 'canceled'
  if (status === 'canceled') {
    console.log('canceled with partial output:', step.output);
  }
}
```

Note: if you have an exhaustive `switch` or a `Record<WorkflowStepStatus, ...>` over step statuses, TypeScript will now require a `'canceled'` case. This reflects a value the runtime was already producing.
