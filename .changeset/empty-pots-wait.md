---
'@mastra/server': minor
---

Added `autoPublish` to stored agent creation so callers can review an initial draft before publishing it. Existing calls continue to publish immediately.

```typescript
await client.createStoredAgent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Help customers with support questions.',
  model: { provider: 'openai', name: 'gpt-5' },
  autoPublish: false,
});
```
