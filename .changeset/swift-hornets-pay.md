---
'@mastra/core': patch
---

Fixed evented workflows started with `run.startAsync()` skipping their `onFinish` and `onError` callbacks. `onFinish` now runs when the background run succeeds, fails, suspends, or is canceled, and `onError` runs when it fails or a tripwire stops it, the same way they do for `run.start()`. `mastra.shutdown()` now also waits, up to its drain timeout, for evented `startAsync()` runs that were already dispatched so their callbacks can finish. Fixes [#29391](https://github.com/mastra-ai/mastra/issues/29391).
