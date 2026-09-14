---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Provider-executed tool results that arrive in a later stream (tool call in one step, result in the next) are now committed to the transcript on the durable engine instead of staying stuck in the call state (ports #14282 to the durable agent loop). Configured transcript transforms also apply to these deferred results instead of being silently skipped.
