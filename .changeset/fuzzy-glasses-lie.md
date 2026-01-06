---
'@mastra/core': patch
---

use `agent.getMemory` to fetch the memory instance on the Agent class to make sure that storage gets set if memory doesn't set it itself.
