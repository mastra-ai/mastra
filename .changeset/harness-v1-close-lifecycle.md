---
'@mastra/core': minor
---

Added Harness v1 close lifecycle markers and closing-state handling.

Sessions now enter a durable `closingAt` phase before terminal `closedAt`.
During close, new work is rejected with `HarnessSessionClosingError`,
previously admitted live-session flushes drain before the close marker, and
descendants are marked closing top-down before terminalizing bottom-up.

`HarnessEvent` now includes `session_closing`, and `HarnessConfig.sessions`
accepts `closeTimeoutMs` to bound the drain window before terminal close.

```ts
const harness = new Harness({
  agents,
  modes,
  defaultModeId,
  sessions: { storage, closeTimeoutMs: 30_000 },
});

harness.subscribe(event => {
  if (event.type === 'session_closing') {
    console.log(event.sessionId, event.closeDeadlineAt);
  }
});
```
