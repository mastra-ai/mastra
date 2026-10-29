---
'@mastra/core': patch
---

Fixed background tasks staying locked to a worker after it shut down gracefully. A worker that stops with `mastra.shutdown()` now releases the tasks it was running right away, so another worker can pick them up immediately instead of waiting for the lease to expire.
