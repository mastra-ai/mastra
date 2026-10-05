---
'@mastra/core': patch
---

Fixed durable and evented agent terminal behavior. Aborted runs now emit an `abort` chunk, report `finishReason` as `aborted`, and call `onAbort` instead of `onFinish`. Failed runs call `onError` instead of `onFinish`. `resume()`, `observe()`, and `recover()` now accept an `onAbort` callback.
