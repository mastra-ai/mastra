---
'@mastra/core': patch
---

Fixed working memory instructions when `agentManaged` is `false` so agents receive read-only context without being told to call an unavailable update tool.
