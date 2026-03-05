---
'@mastra/core': patch
---

Fixed subagent tool defaulting maxSteps to 50 when no stop condition is configured, preventing unbounded execution loops. When stopWhen is set, maxSteps is left to the caller.
