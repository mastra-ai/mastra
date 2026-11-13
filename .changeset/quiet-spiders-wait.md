---
'@mastra/core': patch
---

Added a `timeout` option to `suspend()`. A step can now record how long its suspension may stay unresolved, and the value is stored as `suspendTimeout` on the suspended step result, in the persisted snapshot, and in `getWorkflowSuspendedSteps()`. The engine records the value only; hosts decide what an expired suspension means. The field is cleared when the step completes.
