---
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mssql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
'@mastra/libsql': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Stored workflow definitions now persist across restarts on every major database backend.

Implement the `workflowDefinitions` storage domain for libsql, pg, mysql, mssql, mongodb, and spanner. Previously the stored-workflow persistence path (`POST /stored/workflows`, `Mastra.addStoredWorkflow`) only worked against `@mastra/core`'s in-memory store. Persistent adapters returned `undefined` from `storage.getStore('workflowDefinitions')` and threw when the HTTP handler tried to read/write a workflow.

```ts
const workflowDefinitions = await storage.getStore('workflowDefinitions');
if (!workflowDefinitions) {
  throw new Error('This storage adapter does not support the workflowDefinitions domain');
}

await workflowDefinitions.upsert({
  id: 'greeting-workflow',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  graph: [{ type: 'agent', id: 'greet', agentId: 'greeter-agent' }],
});

const { definitions, total } = await workflowDefinitions.list({ status: 'active' });
const definition = await workflowDefinitions.get('greeting-workflow');
await workflowDefinitions.delete('greeting-workflow');
```

Each adapter now ships a `WorkflowDefinitions*` domain that:

- Creates the shared `mastra_workflow_definitions` table (or Mongo collection) from `WORKFLOW_DEFINITIONS_SCHEMA` during `init()`, plus a default index on `status`.
- Implements `upsert` / `get` / `list` / `delete` matching `WorkflowDefinitionsStorage` semantics (`list` supports `status` and `authorId` filters and orders by `updatedAt` desc). Partial upserts preserve unspecified fields, including `authorId` updates and `createdAt` / `updatedAt` semantics.
- Handles concurrent first-writes race-safely: if two callers upsert the same new id simultaneously, the losing insert detects the duplicate key, re-reads the row, and applies the partial-update path instead of failing.
- Round-trips the JSON columns (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, `metadata`, `graph`) through each adapter's JSON handling, so declarative workflow graphs rehydrate identically no matter which backend they were stored in. Malformed persisted JSON surfaces as an actionable error naming the row and column instead of hydrating raw strings.

Exported class names by adapter: `WorkflowDefinitionsLibSQL`, `WorkflowDefinitionsPG`, `WorkflowDefinitionsMySQL`, `WorkflowDefinitionsMSSQL`, `MongoDBWorkflowDefinitionsStore`, `WorkflowDefinitionsSpanner`. The composite stores (`LibSQLStore`, `PostgresStore`, `MySQLStore`, `MSSQLStore`, `MongoDBStore`, `SpannerStore`) auto-wire the new domain, so callers do not need to construct it manually — `storage.getStore('workflowDefinitions')` now returns a live handle.

The pg adapter reads `createdAt` / `updatedAt` from the auto-added `createdAtZ` / `updatedAtZ` `timestamptz` companion columns to avoid the naive-timestamp / local-TZ drift that a plain `TIMESTAMP` read exhibits under node-pg.

`@mastra/clickhouse` and `@mastra/cloudflare` register the new `mastra_workflow_definitions` table in their table/type maps so shared table constants stay exhaustive (no workflow-definitions domain implementation yet).
