---
'@mastra/core': patch
---

**Fixed cancellation race + audit gaps.** Three correctness fixes on the durable cancel primitive uncovered by deep review:

1. Concurrent cancels no longer double-emit `task_cancellation_requested` or double-abort. The post-commit emit / abort / propagation path now runs only on the CAS winner.
2. The currently-running queued turn is no longer prematurely removed from `pendingQueue` during cancel — it settles through its own abort flow.
3. Cancelled queued items now have their `queueAdmissionReceipts` entry marked `failed` (with the cancel error) in the same CAS write, so `lookupQueueResult()` and admission-duplicate recovery stop treating them as live.

`HarnessSessionCancelledError` now has a public wire code (`harness.session_cancelled`).
