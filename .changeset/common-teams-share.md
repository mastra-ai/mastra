---
'@mastra/ai-sdk': minor
---

Added optional SSE heartbeats to `chatRoute()` so streams can remain active through infrastructure with idle timeouts.

```typescript
chatRoute({
  path: '/chat/:agentId',
  heartbeatMs: 15_000,
});
```
