---
'@mastra/core': patch
---

Allow passing thread metadata to agent.generate and agent.stream. This will update or create the thread with the metadata passed in. Also simplifies the arguments for those two functions into a new memory property.
