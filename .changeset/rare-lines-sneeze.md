---
'@mastra/core': patch
---

Fixed durable and evented agent terminal behavior. Aborted runs now emit an `abort` chunk and call `onAbort` instead of `onFinish`. Failed runs call `onError` instead of `onFinish`. `observe()` and `recover()` now accept an `onAbort` callback.
