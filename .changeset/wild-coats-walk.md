---
'@mastra/server': minor
'mastra': patch
---

Added `POST /agents/:agentId/queue-signal`, which queues a typed signal to run after the active thread run completes, or starts a run right away when the thread is idle.
