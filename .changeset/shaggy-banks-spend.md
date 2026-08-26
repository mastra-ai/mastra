---
'@mastra/client-js': patch
---

Added `runningThreadId` to the session state returned by `session.state()` and an optional `threadId` on `agent_start`/`agent_end` events, so consumers can scope run activity to a thread.
