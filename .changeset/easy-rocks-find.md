---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed observational memory activation replay so already observed work is pruned from the next prompt, including sealed assistant messages that continue with a fresh tail.
