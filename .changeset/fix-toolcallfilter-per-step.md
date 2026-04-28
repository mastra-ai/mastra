---
'@mastra/core': patch
---

Add `processInputStep` to `ToolCallFilter` so it filters tool calls at every step of the agentic loop, not just on initial input. Previously the filter only ran `processInput` (once before the loop), so tool call results from earlier steps accumulated in context on subsequent LLM calls.
