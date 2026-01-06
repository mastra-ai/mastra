---
'@mastra/client-js': patch
---

Add missing status parameter to workflow.runs() method

The `status` parameter was supported by the server API but was missing from the TypeScript types in @mastra/client-js.

Now you can filter workflow runs by status:

```typescript
// Get only running workflows
const runningRuns = await workflow.runs({ status: 'running' });

// Get completed workflows
const completedRuns = await workflow.runs({ status: 'success' });
```
