---
'@mastra/core': patch
---

`Mastra.shutdown()` now hands back the agent thread runs this instance still holds, instead of leaving their thread leases behind. Before, another process had to wait for each lease to expire before it could use the thread, and anyone following the run saw it fail with a lost-lease error.

- A run waiting on a tool approval or suspension is announced as suspended, so it can still be resumed.
- A run still executing is aborted and given a moment to stop, so its tools aren't still running once another process takes the thread.
- The thread lease is released right away, and lease renewal stops.

Fixes #27364.
