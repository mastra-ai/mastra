---
'@mastra/client-js': patch
---

Fixed AgentControllerSession.subscribe() so it resolves only after the stream is established and rejects when it cannot connect (leaving no background retry loop). Reconnect now applies only after an established stream drops, backs off exponentially, and fires a new onReconnect callback on each re-established stream so consumers can re-sync missed events:

```ts
const subscription = await session.subscribe({
  onEvent: event => applyEvent(event),
  onError: error => showDisconnected(error),
  reconnect: { maxRetries: 5, delayMs: 1000, maxDelayMs: 30_000 },
  onReconnect: async () => {
    // Events emitted while disconnected are not replayed — re-sync state.
    applyState(await session.state());
  },
});
```
