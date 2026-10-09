---
'@mastra/core': patch
---

Fixed experimental durable and evented agents to interrupt reasoning-only requests when new messages or signals arrive, without cancelling the run or retaining discarded reasoning in history. Cancelled requests retry the same logical step without consuming maxSteps, advancing stepNumber, or contributing token usage. No separate interruption cap is imposed. Input processors finish instead of being cancelled, signals batch into the first request as before, and the cancelled attempt's model step and inference spans end with finish reason `interrupted`.
