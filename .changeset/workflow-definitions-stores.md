---
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mssql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
---

Implement the `workflowDefinitions` storage domain for pg, mysql, mssql, mongodb, and spanner.

Previously the stored-workflow persistence path (agent-builder `POST /stored/workflows`, `save-workflow` / `list-workflows` / `delete-workflow` tools, `Mastra.addStoredWorkflow`) only worked against `@mastra/libsql`. Every other adapter returned `undefined` from `storage.getStore('workflowDefinitions')` and threw when the HTTP handler or SDK tool tried to read/write a workflow.

Each adapter now ships a `WorkflowDefinitions*` domain that:

- Creates the shared `mastra_workflow_definitions` table (or Mongo collection) from `WORKFLOW_DEFINITIONS_SCHEMA` during `init()`, plus a default index on `status`.
- Implements `upsert` / `get` / `list` / `delete` matching `WorkflowDefinitionsStorage` semantics (`list` supports `status` and `authorId` filters and orders by `updatedAt` desc).
- Round-trips the JSON columns (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, `metadata`, `graph`) through each adapter's JSON handling, so declarative workflow graphs authored via the builder rehydrate identically no matter which backend they were stored in.

Exported class names by adapter: `WorkflowDefinitionsPG`, `WorkflowDefinitionsMySQL`, `WorkflowDefinitionsMSSQL`, `MongoDBWorkflowDefinitionsStore`, `WorkflowDefinitionsSpanner`. The composite stores (`PostgresStore`, `MySQLStore`, `MSSQLStore`, `MongoDBStore`, `SpannerStore`) auto-wire the new domain, so callers do not need to construct it manually — `storage.getStore('workflowDefinitions')` now returns a live handle.
