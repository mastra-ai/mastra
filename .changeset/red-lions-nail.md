---
'@mastra/core': patch
---

Fixed `result.object` being stale after an output processor rejected a structured-output attempt with `abort(reason, { retry: true })`. The retried attempt object is now returned, matching `result.text`, instead of the rejected attempt object. Fixes #20570
