---
'@mastra/core': patch
---

Add `'canceled'` to the public workflow step-status contract. `StepResult`, `SerializedStepResult`, and the derived `WorkflowStepStatus` now include a `StepCanceled` variant, matching the `status: 'canceled'` results the runtime already emits and persists for canceled control-flow steps (e.g. `foreach` and loops). Typed consumers of `getWorkflowRunById()`, `WorkflowState.steps`, and lifecycle callback step results can now represent canceled steps without casts.
