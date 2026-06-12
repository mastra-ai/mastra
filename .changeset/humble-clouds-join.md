---
'@mastra/upstash': patch
---

Added observational memory support and resource-scoped message retrieval to the Upstash storage adapter.

Developers using `@mastra/upstash` can now access observational memory APIs and additional storage domain functionality previously unavailable in the adapter.

Example:

```ts
const messages = await storage.memory.listMessagesByResourceId({
  resourceId: "user-123",
});

const history = await storage.memory.getObservationalMemoryHistory({
  resourceId: "user-123",
});
```