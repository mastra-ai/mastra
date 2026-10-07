---
'@mastra/ai-sdk': minor
---

Added the run's trace ID to `chatRoute`, `handleChatStream`, and `toAISdkStream` responses, so `useChat` clients can attach feedback to a live answer without a server lookup. Fixes [#26140](https://github.com/mastra-ai/mastra/issues/26140).

The `start` chunk now carries `messageMetadata.traceId`. It is merged with object metadata from your own `messageMetadata` callback, which wins on conflicts. Set `sendTraceId: false` to stop sending trace IDs to the client.

```tsx
const { messages } = useChat<UIMessage<{ traceId?: string }>>()
const traceId = messages.at(-1)?.metadata?.traceId
```
