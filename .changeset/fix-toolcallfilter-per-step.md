---
'@mastra/core': patch
---

Add `filterAfterToolSteps` to `ToolCallFilter` so tool calls can be filtered during agentic loops after they are no longer recent. By default, `ToolCallFilter` keeps its previous behavior and only filters the initial input.
