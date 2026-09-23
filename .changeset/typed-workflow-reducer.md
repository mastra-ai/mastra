---
'@mastra/react': minor
---

`useStreamWorkflow` now takes a finished run's result and error from the `workflow-finish` event instead of guessing them from the last step. A run whose failing step was followed by a parallel step now shows its error, and a workflow that maps its output now shows that output rather than the last step's.

`mapWorkflowStreamChunkToWatchResult` now takes a typed workflow stream event from `@mastra/core` instead of `{ type: string; payload: any }`, so TypeScript flags a chunk whose shape does not match a known workflow event.
