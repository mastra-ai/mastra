---
'@mastra/core': patch
---

Add validation to detect when a function is passed as a tool instead of a tool object. Previously, passing a tool factory function (e.g., `tools: { myTool }` instead of `tools: { myTool: myTool() }`) would silently fail - the LLM would request tool calls but nothing would execute. Now throws a clear error with guidance on how to fix it.

