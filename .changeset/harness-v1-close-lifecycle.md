---
'@mastra/core': minor
---

Added a graceful shutdown phase for Harness v1 sessions.

Sessions now enter a durable `closingAt` phase before terminal `closedAt`.
During close, new work is rejected with `HarnessSessionClosingError` while
already-admitted work gets a bounded window to finish.

`HarnessEvent` now includes `session_closing`, child sessions close with their
parent, and `HarnessConfig.sessions` accepts `closeTimeoutMs` to configure the
close window.

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
