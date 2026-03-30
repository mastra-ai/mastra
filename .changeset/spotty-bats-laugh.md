---
'@mastra/core': patch
---

Fixed processInputStep always receiving an empty steps array. Processors can now inspect previous step results (tool calls, LLM responses) when running inside the agentic loop.
