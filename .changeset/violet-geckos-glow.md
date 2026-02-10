---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

**Updated storage adapters for generic storage domain API**

All storage adapters now implement the unified `VersionedStorageDomain` method names. Entity-specific methods (`createAgent`, `getAgentById`, `deleteAgent`, etc.) have been replaced with generic equivalents (`create`, `getById`, `delete`, etc.) across agents, prompt blocks, and scorer definitions domains.

Added `scorer-definitions` domain support to all adapters.

**Before:**

```ts
const store = storage.getStore('agents');
await store.createAgent({ agent: input });
await store.getAgentById({ id: 'abc' });
await store.deleteAgent({ id: 'abc' });
```

**After:**

```ts
const store = storage.getStore('agents');
await store.create({ agent: input });
await store.getById('abc');
await store.delete('abc');
```
