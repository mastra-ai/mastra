---
'@mastra/ai-sdk': minor
---

Exposes `messageMetadata` option in `handleChatStream` for attaching custom metadata to streamed messages.

```ts
const stream = await handleChatStream({
  mastra, agentId: 'my-agent', params,
  messageMetadata: () => ({ createdAt: new Date().toISOString() }),
})
```
