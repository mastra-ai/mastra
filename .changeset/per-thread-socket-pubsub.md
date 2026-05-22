---
'@mastra/core': patch
---

UnixSocketPubSub: skip serialization when broker has 0 remote clients, lazily build ServerFrame only when a subscribed client exists, and automatically elect a new broker with resubscription when the active broker disconnects.
