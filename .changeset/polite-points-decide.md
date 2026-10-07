---
'@mastra/memory': patch
---

Fixed observational memory losing finished tool calls from a thread when an observational memory error stopped the run. The user message and tool results from steps that already completed are now saved before the run stops.
