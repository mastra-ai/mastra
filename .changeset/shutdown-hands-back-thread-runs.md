---
'@mastra/core': patch
'@mastra/deployer': patch
---

`Mastra.shutdown()` now hands back the agent thread runs this instance still holds, instead of leaving their thread leases behind. Before, another process had to wait for each lease to expire before it could use the thread, and anyone following the run saw it fail with a lost-lease error.

- A run waiting on a tool approval or suspension is announced as suspended, so it can still be resumed. A tool call from the same step that is still executing is aborted first.
- A run still executing is aborted, so it starts no further steps. A tool call already executing may still finish after the thread is handed back.
- The thread lease is released right away, and lease renewal stops.

Fixes #27364.
