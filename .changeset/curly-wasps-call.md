---
'@mastra/core': patch
---

Fixed background task recovery so crashed or shutdown workers do not incorrectly mark durable work as timed out.
