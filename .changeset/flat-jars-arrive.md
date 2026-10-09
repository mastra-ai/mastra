---
'@mastra/core': patch
---

Fixed experimental durable and evented agents to interrupt reasoning-only requests when new messages or signals arrive, without cancelling the run or retaining discarded reasoning in history. Cancelled requests retry the same logical step without consuming maxSteps, advancing stepNumber, or contributing token usage. No separate interruption cap is imposed.
