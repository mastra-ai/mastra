---
'@mastra/client-js': patch
'@mastra/inngest': patch
'@mastra/server': patch
'@mastra/core': patch
---


feat: Add field filtering and nested workflow control to workflow execution result endpoint

Adds two optional query parameters to `/api/workflows/:workflowId/runs/:runId/execution-result` endpoint:
- `fields`: Request only specific fields (e.g., `status`, `result`, `error`)
- `withNestedWorkflows`: Control whether to fetch nested workflow data

This significantly reduces response payload size and improves response times for large workflows.

## Server Endpoint Usage

```http
# Get only status (minimal payload - fastest)
GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status

# Get status and result
GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,result

# Get all fields but without nested workflow data (faster)
GET /api/workflows/:workflowId/runs/:runId/execution-result?withNestedWorkflows=false

# Get only specific fields without nested workflow data
GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,steps&withNestedWorkflows=false

# Get full data (default behavior)
GET /api/workflows/:workflowId/runs/:runId/execution-result
```

## Client SDK Usage

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
const workflow = client.getWorkflow('myWorkflow');

// Get only status (minimal payload - fastest)
const statusOnly = await workflow.runExecutionResult(runId, {
  fields: ['status']
});
console.log(statusOnly.status); // 'success' | 'failed' | 'running' | etc.

// Get status and result
const statusAndResult = await workflow.runExecutionResult(runId, {
  fields: ['status', 'result']
});

// Get all fields but without nested workflow data (faster)
const resultWithoutNested = await workflow.runExecutionResult(runId, {
  withNestedWorkflows: false
});

// Get specific fields without nested workflow data
const optimized = await workflow.runExecutionResult(runId, {
  fields: ['status', 'steps'],
  withNestedWorkflows: false
});

// Get full execution result (default behavior)
const fullResult = await workflow.runExecutionResult(runId);
```

## Core API Changes

The `Workflow.getWorkflowRunExecutionResult` method now accepts an options object:

```typescript
await workflow.getWorkflowRunExecutionResult(runId, {
  withNestedWorkflows: false,  // default: true, set to false to skip nested workflow data
  fields: ['status', 'result'] // optional field filtering
});
```

## Performance Impact

For workflows with large step outputs:
- Requesting only `status`: ~99% reduction in payload size
- Requesting `status,result,error`: ~95% reduction in payload size
- Using `withNestedWorkflows=false`: Avoids expensive nested workflow data fetching
- Combining both: Maximum performance optimization
