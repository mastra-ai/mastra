---
'@mastra/core': patch
---

Fixed ToolCallFilter so it can prune tool calls during each agentic loop step without dropping canonical run history, while preserving the latest tool result by default.
