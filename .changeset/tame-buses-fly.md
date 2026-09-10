---
'@mastra/client-js': patch
---

Add an optional `onChunk` callback to agent-controller subscriptions so clients can receive the active run's buffered agent chunks and ongoing output over the existing connection.

```typescript
await session.subscribe({
  onEvent: handleEvent,
  onChunk: handleChunk,
  onReconnect: resetChunks,
  reconnect: true,
});
```
