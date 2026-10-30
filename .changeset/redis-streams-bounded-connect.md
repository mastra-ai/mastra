---
'@mastra/redis-streams': patch
---

Fixed `subscribe()` hanging forever when Redis accepts the connection but never answers, for example a frozen server or a proxy that has stopped forwarding. This also unblocks `subscribeToThread()` and `createSession()`, which wait on it. Connecting the write and read clients is now bounded by `socket.connectTimeout` (5000 ms by default). When it runs out, the call rejects with an error naming the client, and a later call can connect again.
