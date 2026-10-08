---
'@mastra/memory': patch
---

Fixed observational memory dropping the final assistant response when durable agent finalization reconstructs the message list. Final persistence and idle buffering now use the accepted output, without restoring messages removed by output processors. Fixes #25023.
