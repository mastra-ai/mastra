---
'@mastra/dynamodb': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/valkey': patch
'@mastra/redis': patch
---

Listing workflow runs with `summary: true` now returns only each run's `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }`, so callers that only need run metadata no longer receive full snapshots (#28712). A field the run doesn't have is left out. These adapters still read whole snapshots from the database and reduce them before returning.

```ts
const workflows = await storage.getStore('workflows');
const { runs } = await workflows!.listWorkflowRuns({ workflowName: 'order', status: 'running', summary: true });
runs[0]?.snapshot; // { status: 'running', timestamp: 1731456000000 }
```
