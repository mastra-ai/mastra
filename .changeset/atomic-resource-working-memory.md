---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/pg': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Preserve unrelated concurrent JSON working-memory edits with an explicit resource-scoped merge. PostgreSQL merges inside a row-locked transaction, and schema-based memory tools use it when supported. Existing replacement calls remain unchanged. Explicit merge requests fail on unsupported stores or invalid existing JSON instead of reporting a successful save.

```ts
await client.updateWorkingMemory({
  agentId: 'assistant',
  threadId,
  resourceId,
  workingMemory: JSON.stringify({ preferredName: 'Fad' }),
  mode: 'merge',
});
```

Omitted fields survive, objects merge recursively, arrays replace, and explicit null removes a field. This operation does not validate against the agent's working-memory schema; callers must validate their own domain values. Full replacement writers retain their existing replacement semantics.
