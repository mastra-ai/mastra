---
'@mastra/ai-sdk': minor
---

Added experimental smooth streaming support to `handleChatStream()`, `chatRoute()`, and `toAISdkStream()`.

```typescript
const stream = await handleChatStream({
  mastra,
  agentId: 'weatherAgent',
  params,
  experimentalTransform: smoothStream({ chunking: 'word', delayInMs: 20 }),
})
```
