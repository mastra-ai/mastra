---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed agents saying they can't save information when working memory uses `agentManaged: false`. The instructions now say that memory updates automatically after each response. Agents acknowledge new information instead of claiming they can't save it. Only `readOnly: true` tells agents they cannot update working memory.
