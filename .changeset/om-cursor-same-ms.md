---
'@mastra/memory': patch
---

Fixed Observational Memory occasionally hiding a message from the agent before it was observed. When messages arrived within the same millisecond, the next message could land exactly on the observation cursor and be pruned from context even though the observer never saw it.
