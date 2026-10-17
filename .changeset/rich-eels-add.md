---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed streams that reconnect to a run on a replay-capable transport (Redis Streams, Unix sockets) sending every event twice. The transport replayed its own retained copy of the run on top of the cache and ignored the requested offset, so observers saw unnumbered duplicate frames.
