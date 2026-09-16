---
'@mastra/core': patch
---

Added a `StepCanceled` variant to the workflow step-result types so `'canceled'` is part of the public step-status contract. The workflow runtime already produces and persists step results with `status: 'canceled'` for canceled control-flow entries (including `foreach` and loops), but `StepResult`, `SerializedStepResult`, and the derived `WorkflowStepStatus` omitted that variant, forcing `as unknown as StepResult` / `as any` casts internally. Typed consumers of `getWorkflowRunById()`, `WorkflowState.steps`, and lifecycle callback step results can now represent canceled steps without casts.
