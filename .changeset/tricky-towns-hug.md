---
'@mastra/express': patch
'@mastra/client-js': minor
'@mastra/hono': patch
'@mastra/inngest': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
---

Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state.

**What changed:**

- `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
- Added optional `fields` parameter to request only specific fields for better performance
- Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
- Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)

**Before:**

```typescript
// Had to call two different methods for different data
const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
```

**After:**

```typescript
// Single method returns everything
const run = await workflow.getWorkflowRunById(runId);
// Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

// Request only specific fields for better performance (avoids expensive step fetching)
const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

// Skip nested workflow steps for faster response
const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
```

**Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.
