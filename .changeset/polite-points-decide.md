---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory losing finished tool calls from a thread when a memory storage error stopped the run. The user message and tool results from steps that already completed are now saved before the run stops.
