---
'@mastra/core': patch
---

Fixed evented workflows so a failing `.foreach()` iteration now fails the run. Previously the run hung forever with `concurrency > 1`, and with `concurrency: 1` it was reported as `success` with corrupted output. The run now ends with `status: 'failed'` and the iteration's error, matching the default engine.
