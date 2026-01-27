---
'@mastra/playground-ui': patch
---

Refactored WorkflowTrigger component into focused sub-components for better maintainability. Extracted WorkflowTriggerForm, WorkflowSuspendedSteps, WorkflowCancelButton, and WorkflowStepsStatus. Added useSuspendedSteps and useWorkflowSchemas hooks for memoized computations. No changes to public API.
