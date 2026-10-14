---
'@mastra/core': patch
---

Fixed `.foreach()` on the evented workflow engine when an iteration fails. The run now ends with `status: 'failed'` and the iteration's error. Before, it hung forever (`run.start()` never resolved) or, with `concurrency: 1`, finished as `success` with a corrupted output array. Iterations that finish after the failure no longer mark the foreach step successful.
