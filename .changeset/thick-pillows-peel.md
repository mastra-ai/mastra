---
'@mastra/client-js': minor
---

Added reconnect support to `AgentControllerSession.subscribe()` so SSE subscriptions recover after proxy timeouts or transport errors. Fixes #19202.

**Before**

```ts
await session.subscribe({
  onEvent: event => { /* ... */ },
});
```

**After**

```ts
await session.subscribe({
  onEvent: event => { /* ... */ },
  reconnect: true, // or { maxRetries: 5, delayMs: 1000 }
});
```
