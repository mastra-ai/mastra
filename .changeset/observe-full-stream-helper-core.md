---
'@mastra/core': patch
---

Internal refactor: `Agent.observe()` and `DurableAgent.observe()` now share one helper for detaching an observer's `fullStream` subscription instead of each keeping its own copy. No behavior change.
