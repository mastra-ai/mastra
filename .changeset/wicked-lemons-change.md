---
'@mastra/core': patch
---

Fixed subagent tool to default maxSteps to 50 when no stopWhen condition is configured, preventing unbounded agent loops. When stopWhen is set, maxSteps remains unset so the stop condition controls termination.
