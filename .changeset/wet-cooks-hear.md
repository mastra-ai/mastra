---
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
---

Add index configuration options to storage stores

Storage stores now support two new configuration options for index management:

- `skipDefaultIndexes`: When `true`, default performance indexes are not created during `init()`. Useful for custom index strategies or reducing initialization time.
- `indexes`: Array of custom index definitions to create during `init()`. Indexes are routed to the appropriate domain based on table/collection name.

```typescript
// Skip default indexes and use custom ones
const store = new PostgresStore({
  connectionString: '...',
  skipDefaultIndexes: true,
  indexes: [
    { name: 'threads_type_idx', table: 'mastra_threads', columns: ['metadata->>\'type\''] },
  ],
});

// MongoDB equivalent
const mongoStore = new MongoDBStore({
  url: 'mongodb://...',
  skipDefaultIndexes: true,
  indexes: [
    { collection: 'mastra_threads', keys: { 'metadata.type': 1 }, options: { name: 'threads_type_idx' } },
  ],
});
```

Domain classes (e.g., `MemoryPG`, `MemoryStorageMongoDB`) also accept these options for standalone usage.
