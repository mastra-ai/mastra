---
'@mastra/client-js': minor
---

Added the `autoPublish` option to `createStoredAgent()` so SDK users can create an unpublished initial draft.

```typescript
await mastraClient.createStoredAgent({
  id: 'support-agent',
  name: 'Support agent',
  instructions: 'Help customers with support questions.',
  model: { provider: 'openai', name: 'gpt-5' },
  autoPublish: false,
});
```
