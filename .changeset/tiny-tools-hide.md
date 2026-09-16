---
'@mastra/core': patch
---

Fix `ToolCallFilter` with `preserveModelOutput` retaining raw fallback tool results in the model prompt. Filtered results now preserve only explicitly produced compact model output, while raw tool arguments and results remain excluded. Fixes #22630.
