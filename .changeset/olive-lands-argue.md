---
'@mastra/core': patch
---

Fix memory not being affected by agent output processors (#7087). Output processors now correctly modify messages before they are saved to memory storage. The fix ensures that any transformations applied by output processors (like redacting sensitive information) are properly propagated to the memory system.
