---
'@mastra/core': patch
---

Cap UnixSocketPubSub inbound newline-delimited JSON frames and close connections that exceed the limit so a client cannot grow the broker buffer without bound.
