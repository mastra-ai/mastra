---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Fan-out subscribers to the same topic in one `RedisStreamsPubSub` or `ValkeyStreamsPubSub` instance now share one reader connection and one consumer group. Before this change, each subscriber opened its own.

- **Connection use:** Each extra subscriber is dispatched locally, so extra `subscribeToThread()` callers, `AgentController` sessions, or open tabs on a thread no longer add Redis/Valkey connections.
- **Replay:** A subscriber that joins later with the default `startFrom: 'earliest'` still receives existing entries first, with no duplicates.
- **Acknowledgement and retry:** A live entry is acked once every subscriber that received it has settled it. If any of them nacks, the entry is republished once with `deliveryAttempt` incremented, and every fan-out subscriber on the topic receives the retry, as they did when each had its own group.
- **Grouped subscriptions:** Grouped (worker) subscriptions are unaffected.

Fixes [#25952](https://github.com/mastra-ai/mastra/issues/25952).
