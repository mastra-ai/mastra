---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
---

Added database cleanup methods for data retention

New methods `deleteTracesOlderThan` and `deleteWorkflowRunsOlderThan` allow periodic cleanup of old traces and workflow snapshots. Both methods support optional filters to scope deletion:

- **Traces**: Filter by entityType, entityId, organizationId, environment
- **Workflow runs**: Filter by workflowName, status, resourceId

This helps manage database growth by implementing retention policies.

```typescript
// Clean up traces older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const result = await storage.observability.deleteTracesOlderThan({
  beforeDate: thirtyDaysAgo,
  filters: {
    environment: 'production',
  },
});
console.log(`Deleted ${result.deletedCount} traces`);

// Clean up completed workflow runs older than 7 days
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const result2 = await storage.workflows.deleteWorkflowRunsOlderThan({
  beforeDate: sevenDaysAgo,
  filters: {
    status: 'completed',
  },
});
console.log(`Deleted ${result2.deletedCount} workflow runs`);
```

Resolves https://github.com/mastra-ai/mastra/issues/7479
