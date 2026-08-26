---
'@mastra/core': patch
---

Streamed messages and run lifecycle events now name the thread they belong to. Messages created during a run — assistant messages and echoed signals alike — carry the session's active thread id, and `agent_start`/`agent_end` events include an optional `threadId`, so clients can tell which thread a run is on.
