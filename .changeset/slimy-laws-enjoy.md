---
'@mastra/core': patch
---

Fixed UnixSocketPubSub accepting unbounded inbound frames. Added a `maxInboundFrameBytes` option (default 64 MiB); a connection that sends a larger frame is disconnected so a single peer can no longer exhaust broker memory. Fixes #22376
