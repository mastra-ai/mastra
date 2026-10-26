---
'@mastra/server': patch
---

Fixed agent streams disconnecting during long tool calls or slow model responses by sending keepalive comments every 25 seconds. These comments don't change agent events or observation replay offsets.
