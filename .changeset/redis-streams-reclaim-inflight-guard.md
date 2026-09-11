---
'@mastra/redis-streams': patch
---

`RedisStreamsPubSub`'s reclaim loop no longer re-invokes a subscription's own handler for a message that is still being processed locally. Previously, a grouped subscription's `XAUTOCLAIM` reclaim could claim a still-pending entry back onto the same consumer and deliver it again — invoking the callback a second time, concurrently, for the same event whenever a handler ran longer than `reclaimIdleMs`. Because the reclaim path never incremented `deliveryAttempt`, this redelivery repeated every reclaim cycle indefinitely, bypassing `maxDeliveryAttempts` and producing duplicate concurrent executions (e.g. long-running workflow steps). Each subscription now tracks its in-flight stream entry IDs and the reclaim loop skips any entry whose original delivery has not yet settled. Genuine cross-consumer reclaim (a live sibling picking up a crashed consumer's pending entry) is unaffected. Fixes #23648.
