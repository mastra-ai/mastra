---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/mssql': minor
'@mastra/lance': minor
'@mastra/libsql': minor
'@mastra/convex': minor
'@mastra/upstash': minor
'@mastra/mongodb': minor
'@mastra/dynamodb': minor
'@mastra/cloudflare': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare-d1': minor
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/memory': patch
'@mastra/inngest': patch
'@mastra/ai-sdk': patch
---

Refactor storage architecture to use domain-specific stores via `getStore()` pattern

### Summary

This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

### Migration Guide

All direct method calls on storage instances should be updated to use `getStore()`:

```typescript
// Before
const thread = await storage.getThreadById({ threadId });
await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
await storage.createSpan(span);

// After
const memory = await storage.getStore('memory');
const thread = await memory?.getThreadById({ threadId });

const workflows = await storage.getStore('workflows');
await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

const observability = await storage.getStore('observability');
await observability?.createSpan(span);
```

### Available Domains

- **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
- **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
- **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
- **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
- **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

### Breaking Changes

- Passthrough methods have been removed from `MastraStorage` base class
- All storage adapters now require accessing domains via `getStore()`
- The `stores` property on storage instances is now the canonical way to access domain storage

### Internal Changes

- Each storage adapter now initializes domain-specific stores in its constructor
- Domain stores share database connections and handle their own table initialization
