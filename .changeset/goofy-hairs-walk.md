---
'@mastra/core': minor
---

Added session-owned Harness state.

Harness state is now available through `harness.session.state`, so new integrations can read and write state from the same session object that owns mode, model, thread, and run data.

**Example**

```ts
const state = harness.session.state.get();
await harness.session.state.set({ yolo: true });
```

`Harness.getState()` and `Harness.setState()` still work and now delegate to `harness.session.state`.
