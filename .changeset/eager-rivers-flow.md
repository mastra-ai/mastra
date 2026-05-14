---
'@mastra/mongodb': minor
---

Added `visibility` and `favoriteCount` fields to the stored agent and skill schemas so MongoDB-backed deployments can persist and surface favorite state.

**Example**

```ts
const storage = new MongoDBStore({ /* config */ });
const agents = storage.getStore('agents');

await agents.create({
  id: 'agent-42',
  // ...
  visibility: 'public',
});
```
