---
'@mastra/client-js': patch
---

Agent controller session subscriptions now detect silent connections instead of hanging forever. When a stream receives no data (including server heartbeats) for `idleTimeoutMs` (default 60 seconds), it's treated as dropped, so `reconnect` and `onReconnect` re-establish it, or `onError` fires when reconnect is off. Opening a stream that never responds is bounded by the same limit. Set `idleTimeoutMs: 0` to disable.

```ts
const subscription = await session.subscribe({
  onEvent: handleEvent,
  onReconnect: resync,
  reconnect: true,
  idleTimeoutMs: 60_000,
});
```
