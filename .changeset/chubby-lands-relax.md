---
'@mastra/core': patch
---

Fixed stopped durable agent runs keeping a thread active when background tasks are enabled, so the next message can start normally.
