---
'@mastra/core': patch
---

Fixed a memory issue when using useChat where new messages were formatted as ui messages, were mixed with stored core messages in memory, and a mixed list was sent to AI SDK, causing it to error
