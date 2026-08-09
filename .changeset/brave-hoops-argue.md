---
'@mastra/core': patch
---

Add a workflow `onStart` lifecycle hook. It is awaited before a run executes, receives the run context, and fires only on initial start — not on resume, restart, or time travel. Unlike `onFinish`/`onError`, errors thrown in `onStart` reject the `start()`/`stream()` call so it can act as a pre-flight gate, for example a quota check.
