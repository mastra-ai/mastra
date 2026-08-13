---
'@mastra/core': patch
---

Stop persisting the raw provider request echo in agent-loop snapshots: pruneAgentLoopSnapshot now drops stepResult.request (the full serialized prompt plus tool schemas, duplicated on both sides of every step result and rewritten at every step boundary; measured at 24% of all persisted snapshot bytes in production). Nothing reads it back and resume rebuilds requests from messageListState. All routing members of stepResult are preserved.
