---
'@mastra/core': patch
---

Fixed DurableAgent dropping cached-input, cache-write, and reasoning token counts from `model_generation` span usage, so tracing exporters and cache/reasoning token metrics now match the regular Agent.
