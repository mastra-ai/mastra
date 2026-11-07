---
'@mastra/server': patch
---

Fixed the agent controller session stream and the background task stream staying open forever when the client disconnected before the stream started.
