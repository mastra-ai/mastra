---
'@mastra/core': minor
---

Added run fencing to the storage API, so storage adapters can reject writes from a durable agent execution that lost its run to crash recovery.

- Workflows stores have new `claimRunOwnership()`, `renewRunOwnership()`, `releaseRunOwnership()`, and `getRunOwnership()` methods.
- Memory stores have a new `raiseRunFence()` method.
- Methods that write run data, such as `saveMessages()`, `saveThread()`, `persistWorkflowSnapshot()`, and `updateWorkflowState()`, accept an optional `fence`. A write whose fence is no longer the run's current claim throws `RunFenceConflictError`.
- `supportsRunFencing()` reports whether a store implements this. It can return a promise, for stores that must probe the backend first, and should reject when the store can't tell yet. It defaults to `false`, so custom storage adapters keep working without changes, and durable agents fall back to the PubSub lease for them.
- SQL adapters keep claims in two new tables, `mastra_workflow_run_owners` and `mastra_memory_run_fences`.
