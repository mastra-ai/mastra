---
'@mastra/client-js': minor
---

Added `autoPublish` to stored agent updates so callers can activate a newly created version immediately.

```ts
await client.getStoredAgent('agent-id').update({
  instructions: 'Updated instructions',
  autoPublish: true,
});
```
