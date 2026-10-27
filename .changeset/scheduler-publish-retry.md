---
'@mastra/core': patch
---

Scheduler now retries a failed workflow or agent schedule dispatch up to three times before recording it as failed. On sustained publish errors, dispatch and the error callback can take up to 300 ms longer.
