---
'@mastra/core': patch
---

Fixed evented agent runs with Postgres storage that hung when a worker process stopped. Another worker can now finish the run, and the original caller gets the result. Completed loop iterations keep their saved results and state without running again. Recovery-only snapshots are removed when a workflow suspends without snapshot persistence. Snapshot pruning still applies at terminal and control-flow boundaries without discarding inputs needed for recovery.

Runs started on older versions can finish after upgrading, but do not have guaranteed crash recovery. On stores that support workflow step guards, internal workflow events go through the shared broker instead of staying in the starting process. Runs with `shouldPersistSnapshot` disabled keep a recovery snapshot until they end or suspend.

Storage adapters can opt in by returning `true` from `supportsWorkflowStepGuards()`. Their `updateWorkflowResults` implementation must check the optional `startGuard` or `completionGuard` against the stored result in the same atomic operation that writes the updated result. `@mastra/core/storage` exports `assertWorkflowStepGuard`, `WorkflowStepConflictError`, and `isWorkflowStepConflictError` for implementing these checks.
