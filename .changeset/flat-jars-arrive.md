---
'@mastra/core': patch
---

Fixed experimental durable and evented agents to interrupt reasoning-only requests when new messages or signals arrive, without cancelling the run or retaining discarded reasoning in history.
