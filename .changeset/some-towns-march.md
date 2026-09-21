---
'@mastra/redis-streams': patch
---

Fixed a connection and memory leak when `unsubscribe()` raced an in-flight `subscribe()`. Subscribing takes several Redis round trips, and an unsubscribe issued during that window used to return without doing anything — the subscription then finished registering afterward and leaked its dedicated reader connection and read loop with no way to ever stop them. Short-timeout request/reply flows (such as the agent runtime's cross-process discovery) hit this window regularly against remote Redis. `unsubscribe()` and `close()` now wait for an in-flight subscribe to finish and tear it down, and duplicate concurrent `subscribe()` calls for the same topic and callback share one setup instead of orphaning the first.
