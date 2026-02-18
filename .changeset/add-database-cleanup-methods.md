---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mssql': minor
'@mastra/dynamodb': minor
'@mastra/upstash': minor
---

Added `deleteTracesOlderThan` and `deleteWorkflowRunsOlderThan` methods for database cleanup and data retention

These methods allow periodic cleanup of old traces and workflow run snapshots, helping manage database growth over time. Both support optional filters to scope deletion:

- **`deleteTracesOlderThan`** - Delete traces created before a given date, optionally filtered by `entityType`, `entityId`, `organizationId`, or `environment`
- **`deleteWorkflowRunsOlderThan`** - Delete workflow runs created before a given date, optionally filtered by `workflowName`, `status`, or `resourceId`

```typescript
// Clean up traces older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const result = await storage.observability.deleteTracesOlderThan({
  beforeDate: thirtyDaysAgo,
  filters: { environment: "production" },
});
console.log(`Deleted ${result.deletedCount} traces`);

// Clean up completed workflow runs older than 7 days
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const result2 = await storage.workflows.deleteWorkflowRunsOlderThan({
  beforeDate: sevenDaysAgo,
  filters: { status: "completed" },
});
console.log(`Deleted ${result2.deletedCount} workflow runs`);
```

Resolves https://github.com/mastra-ai/mastra/issues/7479
