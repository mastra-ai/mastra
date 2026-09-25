---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed durable agents looping until maxSteps when a model response ended with a terminal finish reason (content-filter refusal or length truncation) alongside a tool call. The loop now stops instead of re-sending the same request and re-triggering the same refusal (ports #17893 to the durable agent loop).
