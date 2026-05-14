---
'@mastra/cloudflare': minor
---

Added favorites support to the Cloudflare KV adapter so favorite records for stored agents and skills can be persisted alongside other Cloudflare-backed tables.

**Example**

```ts
const storage = new CloudflareStore({ /* config */ });
const favorites = await storage.getStore('favorites');

await favorites?.favorite({
  userId: 'user-1',
  entityType: 'agent',
  entityId: 'agent-42',
});
```
