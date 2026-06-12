---
'@mastra/core': patch
---

Fixed channel subscription state leaking across agents sharing the same storage adapter by scoping external thread IDs per agent.