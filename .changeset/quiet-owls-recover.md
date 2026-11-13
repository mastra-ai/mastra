---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()`, `recoverActiveRuns()` and automatic recovery skipping the agent's `defaultOptions` `onFinish`, `onError` and `onAbort` callbacks. Recovered runs now call them like `stream()` does, and callbacks passed to `recover()` run after them.
