---
'@mastra/react': patch
---

Fixed chat run correlation by retaining run IDs on streamed messages and exposing the active run ID from useChat. This lets interfaces keep unfinished history separate from current execution.
