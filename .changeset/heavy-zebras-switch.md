---
'@mastra/core': patch
---

Fixed a durable agent run losing the user's message when the process died right after the message was saved to memory. When running checkpoints are persisted (an `EventedAgent`, a `shouldPersistSnapshot` policy that includes `'running'`, or `recovery: { durableAgents: 'auto' }` on `Mastra` with no custom `shouldPersistSnapshot` policy), the run is now saved as recoverable before the message is stored, so recovery picks it up and answers the message instead of leaving it unanswered in the thread. Without running checkpoints, no run is recoverable after a crash, and that is unchanged. Fixes #30791.
