---
'@mastra/core': patch
---

Fixed approving a tool loaded by `ToolSearchProcessor` after a server restart. The approved call failed with `Tool "<name>" not found` when memory no longer returned the search result. It now runs with the tools it had when the model made the call. Fixes [#29196](https://github.com/mastra-ai/mastra/issues/29196).
