---
'@mastra/pg': patch
---

Fixed `PostgresStore.init()` failing with "RoutingDbClient already has a pinned client" when a single store is shared across concurrent requests (for example, request-scoped Mastra instances reusing one store/pool). Concurrent `init()` calls are now coalesced into a single shared initialization instead of each pinning the client.

Also, `init()` is now a no-op when `disableInit: true`, so apps that manage their database schema externally are no longer forced through the connect-and-pin path.
