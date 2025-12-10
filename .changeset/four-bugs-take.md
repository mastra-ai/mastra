---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/inngest': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Preserve error details when thrown from workflow steps

Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

**Before:**
```typescript
const result = await workflow.execute({ input });
if (result.status === 'failed') {
  // Custom error properties were lost
  console.log(result.error); // "Step execution failed" (just a string)
}
```

**After:**
```typescript
const result = await workflow.execute({ input });
if (result.status === 'failed') {
  // Custom properties are preserved
  console.log(result.error.message);      // "Step execution failed"
  console.log(result.error.statusCode);   // 429
  console.log(result.error.cause?.name);  // "RateLimitError"
}
```

- Changed `WorkflowState.error` and `WorkflowRunState.error` types from `string | Error` to `SerializedError`
- Updated `formatResultError` in execution engines to serialize errors immediately via `.toJSON()`
- Errors are now consistently serialized at workflow level for storage compatibility
- Step-level errors remain as `Error` instances; only workflow-level `result.error` is serialized
- Custom error properties (statusCode, responseHeaders, cause chain, etc.) are preserved through serialization
- Added `UpdateWorkflowStateOptions` type to consolidate workflow state update parameters across all storage implementations

**Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

Other changes:
- Added `UpdateWorkflowStateOptions` type for workflow state updates
