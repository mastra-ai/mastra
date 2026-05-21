---
'@mastra/core': patch
---

UnixSocketPubSub: skip serialization when broker has 0 remote clients and lazily build ServerFrame only when a subscribed client exists. This eliminates unnecessary JSON.stringify overhead for solo processes.
