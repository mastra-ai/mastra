---
'@mastra/redis-streams': patch
---

Fixed a connection and memory leak when `unsubscribe()` raced an in-flight `subscribe()`.

Subscribing takes several Redis round trips. An unsubscribe issued during that window used to return without doing anything, and the subscription then finished registering afterward, leaking its dedicated reader connection and read loop with no way to ever stop them. Short-timeout request/reply flows (such as the agent runtime's cross-process discovery) hit this window regularly against remote Redis.

`unsubscribe()` and `close()` now wait for an in-flight subscribe to finish and tear it down. Duplicate concurrent `subscribe()` calls for the same topic and callback share one setup instead of orphaning the first.

Because both calls now wait for in-flight subscribes to settle, they inherit the client's connection behavior: with Redis unreachable and node-redis's default reconnect strategy (retry forever), a `close()` issued mid-subscribe blocks until Redis is reachable again. Pass a bounded `reconnectStrategy` via `redisOptions` if shutdown must not wait on a dead Redis.
