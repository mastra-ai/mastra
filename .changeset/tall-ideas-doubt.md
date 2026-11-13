---
'@mastra/core': minor
---

Added `getRunOwnerships({ runIds })` to workflows storage (#28712). It returns the ownership records of many runs at once, in a `Map` keyed by run ID; runs without a stored record are left out. Stores without a batch query fall back to reading each run with `getRunOwnership()`, at most 8 at a time.

```ts
const workflows = await mastra.getStorage()?.getStore('workflows');
const owners = await workflows?.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners?.get('run-1')?.live; // true while the run's lease hasn't expired
```

The in-memory store now honors `summary: true` in `listWorkflowRuns()`: each run's snapshot comes back as only `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }`.

```ts
const { runs } = await workflows!.listWorkflowRuns({ workflowName: 'charge', status: 'running', summary: true });
runs[0]?.snapshot; // { status: 'running', timestamp: 1731456000000, parentWorkflow: { workflowId: 'order', runId: 'run-1' } }
```

In the in-memory store, `updateWorkflowResults()`, `updateWorkflowState()` and `updateWorkflowRunHeader()` now move a run's `updatedAt`, as they do in the database adapters.
