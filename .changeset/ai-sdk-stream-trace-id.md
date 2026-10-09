---
'@mastra/ai-sdk': minor
---

The `messageMetadata` callback in `chatRoute`, `handleChatStream`, and `toAISdkStream` now receives the run's `traceId`. Return it as message metadata so `useChat` clients have the trace ID on a live answer, for example to attach feedback, without a server lookup. Fixes [#26140](https://github.com/mastra-ai/mastra/issues/26140).

```ts
chatRoute({
  path: '/chat/:agentId',
  messageMetadata: ({ part, traceId }) => (part.type === 'start' ? { traceId } : undefined),
});
```

`traceId` is undefined when tracing is disabled or with `@mastra/core` versions before 1.75.0.
