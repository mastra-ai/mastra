---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/pg': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Concurrent schema-based working memory updates no longer lose each other's fields when using PostgreSQL. With `scope: 'resource'`, the update tool now deep-merges partial updates inside a row-locked transaction, so writers in separate processes that change different fields all keep their changes. Other storage adapters keep the existing in-process behavior.

You can also merge from your own code or over HTTP:

```ts
await memory.mergeWorkingMemory({ threadId, resourceId, workingMemory: { city: 'Berlin' } });

await client.updateWorkingMemory({
  agentId,
  threadId,
  resourceId,
  workingMemory: JSON.stringify({ city: 'Berlin' }),
  mode: 'merge',
});
```

Merges are rejected (HTTP `400` from the server) when the storage adapter doesn't support atomic merges, instead of silently replacing the record.
