---
'@mastra/memory': patch
'@mastra/core': patch
---

Updated Observational Memory to use data-part signals for reliable lifecycle marker delivery. Background buffering and observation strategies now prefer `sendDataPartSignal` over `writer.custom()`, ensuring markers are delivered even when the stream is idle.
