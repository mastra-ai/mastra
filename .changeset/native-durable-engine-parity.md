---
'@mastra/core': patch
---

Allow native durable agents to configure journal `storageVersion` and `maxSteps`. Warn when inherited durable execution cannot carry request context values or call options across processes. Keep late observer response messages complete when replay is disabled, and report output processor rewrites in final response messages and on the correct steps after feedback continuation.
