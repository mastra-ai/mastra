---
'@mastra/core': patch
---

Fixed evented workflows started with `run.startAsync()` skipping their `onFinish` and `onError` callbacks. The callbacks now run when the background run succeeds, fails, suspends, or is canceled, the same way they do for `run.start()`. `mastra.shutdown()` now also waits, up to its drain timeout, for in-flight `startAsync()` runs so their callbacks can finish. Fixes [#29391](https://github.com/mastra-ai/mastra/issues/29391).
