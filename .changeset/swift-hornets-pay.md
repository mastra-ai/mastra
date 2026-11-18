---
'@mastra/core': patch
---

Fixed evented workflows started with `run.startAsync()` skipping their `onFinish` and `onError` callbacks. The callbacks now run the same way they do for `run.start()`: `onFinish` when the background run succeeds, fails, suspends, or is canceled, and `onError` when it fails or trips a tripwire. `mastra.shutdown()` now also waits, up to its drain timeout, for in-flight evented `startAsync()` runs so their callbacks can finish. Fixes [#29391](https://github.com/mastra-ai/mastra/issues/29391).
