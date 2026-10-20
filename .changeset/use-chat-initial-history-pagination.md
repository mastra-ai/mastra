---
'@mastra/react': minor
---

Added `initialHistoryPagination` to `useChat()`. When you use `withInitialHistory`, it tells you whether older messages exist beyond the first history page, so you can show a "load older messages" control without making a separate history request.

```ts
const { messages, initialHistoryPagination } = useChat({
  agentId: 'support-agent',
  resourceId: 'user-123',
  threadId: 'thread-abc',
  enableThreadSignals: true,
  withInitialHistory: { perPage: 20 },
});

// { hasMore: true }: older messages exist
// { hasMore: false }: the page reaches the start of the thread
// undefined: history is disabled, still loading, or the subscription ended
```

The value only describes the first page for the current agent, resource, thread and `withInitialHistory` setting. It resets when any of these change and is not changed by live output or `setMessages()`.
