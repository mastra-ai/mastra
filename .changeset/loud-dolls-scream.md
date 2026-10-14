---
'@mastra/core': minor
'@mastra/factory': patch
---

Added a `threadCreated` flag to `onSessionCreated` listeners. It is `true` when `createSession()` created the session's thread, so a listener can tell the controller's default model and mode apart from choices made on a resumed thread.

```ts
controller.onSessionCreated((session, { threadCreated }) => {
  if (threadCreated) {
    // Fresh thread: its model is the controller default, safe to replace.
  }
});
```
