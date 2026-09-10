---
'@mastra/server': patch
---

Fixed Factory crashing with a JavaScript heap out of memory error during long agent runs. Session event snapshots no longer copy the live streaming message, tool results, or shell output onto every display-state update.
