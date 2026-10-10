---
'@mastra/core': minor
---

Added run fencing to the storage API, so storage adapters can reject writes from a durable agent execution that lost its run to crash recovery.

- Workflows stores have new `claimRunOwnership()`, `renewRunOwnership()`, `releaseRunOwnership()`, and `getRunOwnership()` methods.
- Memory stores have new `raiseRunFence()` and `retireRunFence()` methods.
- Methods that write run data, such as `saveMessages()`, `saveThread()`, `persistWorkflowSnapshot()`, and `updateWorkflowState()`, accept an optional `fence`. A write whose fence is no longer the run's current claim throws `RunFenceConflictError`.
- `supportsRunFencing()` reports whether a store implements this. It can return a promise, for stores that must probe the backend first, and should reject when the store can't tell yet. It defaults to `false`, so custom storage adapters keep working without changes, and durable agents fall back to the PubSub lease for them.
- A run is fully fenced only when both the workflows store and the memory store it writes to support fencing. If only the workflows store does, for example because a composite store takes memory from another adapter or the agent's `Memory` has its own storage, an execution that lost the run can't write workflow state anymore, but its messages, threads, and working memory still land. If only the memory store does, nothing is fenced.
- Stores that support fencing keep one ownership record per run, plus one memory fence record per run with memory. Stores with retention support prune them with the new `workflows.runOwnership` and `memory.runFences` retention keys. Ownership records age out by inactivity, and fence records once the execution holding them settles. A run's first generation is taken from the store's clock, so a run that reuses a `runId` after its records were pruned still claims a higher generation than its earlier executions.

**Pruning run fencing records**

```ts
const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
  retention: {
    workflows: { runOwnership: { maxAge: '1d' } },
    memory: { runFences: { maxAge: '1d' } },
  },
});

// From your own scheduler
await storage.prune();
```

**Writing with a fence**

```ts
import { RunFenceConflictError } from '@mastra/core/storage';

const workflows = await storage.getStore('workflows');
const claim = await workflows.claimRunOwnership({ runId, ownerId: 'worker-a', leaseMs: 30_000 });

if (claim.acquired) {
  const fence = { runId, ownerId: 'worker-a', generation: claim.record.generation };
  try {
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot, fence });
  } catch (error) {
    if (error instanceof RunFenceConflictError) {
      // Another execution claimed the run since. Nothing was written.
    }
  }
}
```

**Opting in from a custom adapter**

```ts
import { RunFenceConflictError, resolveRunFence, WorkflowsStorage } from '@mastra/core/storage';

class MyWorkflowsStorage extends WorkflowsStorage {
  supportsRunFencing() {
    return true;
  }

  // Also implement claimRunOwnership(), renewRunOwnership(), releaseRunOwnership() and getRunOwnership().

  async persistWorkflowSnapshot({ workflowName, runId, snapshot, fence }) {
    // The fence passed in, or the one of the durable agent execution making this write
    const current = resolveRunFence(this, fence, runId);
    // In one transaction: if `current` is set and is no longer the run's claim,
    // throw new RunFenceConflictError(current, 'persistWorkflowSnapshot'). Otherwise write.
  }
}
```
