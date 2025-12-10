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

fix(workflows): preserve error details when thrown from workflow steps

- Changed `WorkflowState.error` and `WorkflowRunState.error` types from `string | Error` to `SerializedError`
- Updated `formatResultError` in execution engines to serialize errors immediately via `.toJSON()`
- Errors are now consistently serialized at workflow level for storage compatibility
- Step-level errors remain as `Error` instances; only workflow-level `result.error` is serialized
- Custom error properties (statusCode, responseHeaders, cause chain, etc.) are preserved through serialization
- Added `UpdateWorkflowStateOptions` type to consolidate workflow state update parameters across all storage implementations
