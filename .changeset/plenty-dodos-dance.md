---
'@mastra/core': patch
---

Fixed approving a tool that `ToolSearchProcessor` loaded, after a server restart. The approval failed with `Tool "<name>" not found` when memory no longer returned the search result, for example because it was outside the `lastMessages` window or observational memory was enabled. The approved call now gets the tools it had when the model made it. Fixes [#29196](https://github.com/mastra-ai/mastra/issues/29196).
