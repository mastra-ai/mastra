---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` losing tools that `ToolSearchProcessor` loaded during the run. After a crash, recovery in a fresh process now reads the run's latest transcript and restores those tools, so the model's pending tool call runs once instead of failing with `ToolNotFoundError` and being retried under a new call id.
