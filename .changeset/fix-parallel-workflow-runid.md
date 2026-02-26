---
"@mastra/core": patch
---

Fixed parallel workflow tool calls so each call runs independently.

When an agent starts multiple tool calls to the same workflow at the same time, each call now runs with its own workflow run context. This prevents duplicated results across parallel calls and ensures each call returns output for its own input. Also ensures workflow tool suspension and manual resumption correctly preserves the run context.
