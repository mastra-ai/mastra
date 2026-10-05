---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Fan-out subscribers to the same topic in one `RedisStreamsPubSub` or `ValkeyStreamsPubSub` instance now share one reader connection and one consumer group. Before this change, each subscriber opened its own. Each extra subscriber is dispatched locally, so extra `subscribeToThread()` callers, `AgentController` sessions, or open tabs on a thread no longer add Redis/Valkey connections. Delivery is unchanged: a subscriber that joins later with the default `startFrom: 'earliest'` still receives existing entries first, with no duplicates. An event is acked once every subscriber has acked it, and it is retried if any subscriber nacks. Grouped (worker) subscriptions are unaffected.

Fixes [#25952](https://github.com/mastra-ai/mastra/issues/25952).
