---
'@mastra/core': minor
---

Default `createWorkflow` now auto-promotes a workflow to the evented engine when it declares a `schedule`. Users no longer need to import `createWorkflow` from `@mastra/core/workflows/evented` to use scheduling — the public Workflow API is unchanged, and scheduled fires share a single execution path with manual `start()` calls. The previous `MASTRA_WORKFLOW_SCHEDULE_REQUIRES_EVENTED_ENGINE` error is removed; storage-adapter mismatches now throw a single clear error pointing at the `schedule` field.
