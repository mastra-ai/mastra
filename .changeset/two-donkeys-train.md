---
'@mastra/core': patch
---

Fix agent network working memory tool routing. Memory tools are now included in routing agent instructions but excluded from its direct tool calls, allowing the routing agent to properly route to tool execution steps for memory updates.
