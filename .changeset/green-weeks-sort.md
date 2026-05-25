---
'@mastra/memory': patch
'@mastra/core': patch
---

Updated Observational Memory to use `sendDataPart()` for reliable lifecycle marker delivery. Background buffering and observation strategies now prefer `sendDataPart()` over `writer.custom()`, ensuring markers are delivered even when the stream is idle.
