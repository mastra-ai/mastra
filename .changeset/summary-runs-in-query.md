---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/dsql': patch
---

Listing workflow runs with `summary: true` now returns only each run's `status`, `timestamp` and, for nested runs, `parentWorkflow: { workflowId, runId }` (#28712). The database sends only these fields, so listing many runs no longer transfers their full snapshots. A field the run doesn't have is left out.

```ts
const workflows = await storage.getStore('workflows');
const { runs } = await workflows!.listWorkflowRuns({ workflowName: 'order', status: 'running', summary: true });
runs[0]?.snapshot; // { status: 'running', timestamp: 1731456000000 }
```
