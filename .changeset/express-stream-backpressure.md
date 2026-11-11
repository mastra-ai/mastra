---
'@mastra/express': patch
---

Streaming routes now wait for a slow client to catch up instead of buffering the whole stream in memory.
