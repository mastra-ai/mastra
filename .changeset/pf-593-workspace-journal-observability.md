---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Developers can now correlate Harness workspace action journal entries with observability traces.

Workspace action journal entries accept optional `traceId` and `spanId` fields, and journal list calls can filter by those identifiers when debugging session activity. `spanId` requires `traceId` because span ids are trace-scoped. Workspace `WORKSPACE_ACTION` span handles also expose their trace/span identity and can record a durable `journalEntryId`.

```ts
await storage.listWorkspaceActionJournalEntries({
  sessionId,
  resourceId,
  traceId,
  spanId,
  limit: 50,
});
```
