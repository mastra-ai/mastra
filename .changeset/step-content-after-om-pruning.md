---
'@mastra/core': patch
---

Fixed step content going empty for steps that run after Observational Memory (or another input processor) removes earlier response messages mid-run. `steps[n].content`, `toolCalls`, and the steps passed to `processInputStep`/`prepareStep` now keep their tool calls, tool results, and text instead of returning empty arrays.
