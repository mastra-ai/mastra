---
'@mastra/redis-streams': patch
---

`RedisStreamsPubSub`'s reclaim loop no longer re-invokes a subscription's own handler for a message that is still being processed locally. Previously, a grouped subscription's `XAUTOCLAIM` reclaim could claim a still-pending entry back onto the same consumer and deliver it again — invoking the callback a second time, concurrently, for the same event whenever a handler ran longer than `reclaimIdleMs`. Because the reclaim path never incremented `deliveryAttempt`, this redelivery repeated every reclaim cycle indefinitely, bypassing `maxDeliveryAttempts` and producing duplicate concurrent executions (e.g. long-running workflow steps). Each subscription now tracks its in-flight stream entry IDs, and the reclaim loop lists idle pending entries with `XPENDING` and only `XCLAIM`s the ones it is not already processing. Claiming resets an entry's idle clock even for its current owner, so filtering before the claim (rather than skipping after it) also keeps a genuinely hung handler's entry reclaimable by a live sibling consumer. Fixes #23648.

Behavior change: a subscription never redelivers to itself anymore, so a handler that hangs (never acks or nacks) is only recovered by a *different* consumer in the group. In a single-consumer group that message stays pending until the process restarts. Set the new `inFlightTimeoutMs` option to have the subscription nack such a message on the handler's behalf after that long; the nack republishes with an incremented `deliveryAttempt`, so `maxDeliveryAttempts` still bounds retries. It defaults to `0` (disabled).

The package now documents a Redis 7.0+ requirement: the reclaim loop relies on `XCLAIM` dropping trimmed entries from the pending list, which Redis 6 does not do.
