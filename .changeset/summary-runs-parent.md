---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Listing workflow runs with `summary: true` now also returns `parentWorkflow: { workflowId, runId }` for nested runs, next to `status` and `timestamp` (#28712). The database still sends only these fields, so listing many runs doesn't transfer their full snapshots. A field the run doesn't have is left out instead of returned as `null`.

```ts
const workflows = await storage.getStore('workflows');
const { runs } = await workflows!.listWorkflowRuns({ workflowName: 'charge', status: 'running', summary: true });
runs[0]?.snapshot; // { status: 'running', timestamp: 1731456000000, parentWorkflow: { workflowId: 'order', runId: 'run-1' } }
```
