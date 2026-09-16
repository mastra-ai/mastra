---
'@mastra/core': patch
---

Fixed pubsub subscription leak in `DurableAgent.stream()` and `DurableAgent.resume()`. Previously, when the auto-cleanup timer fired after a stream finished, the `streamCleanup()` function was not called, leaving pubsub subscriptions active. This caused memory leaks and potential "zombie" event handlers. The fix ensures `streamCleanup()` is called before registry cleanup in the auto-cleanup timer, and passes `idleTimeoutMs` through to `createDurableAgentStream` to enable proper idle termination for crashed producers. Fixes #24070