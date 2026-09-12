---
'@mastra/valkey-streams': patch
---

Fixed `ValkeyStreamsPubSub` consumer-group reclaim so an idle unacknowledged message is redelivered to another live consumer in the group instead of back to the consumer whose handler is still processing it. Previously a handler running longer than `reclaimIdleMs` was invoked again, concurrently, for the same event on every reclaim tick with no `deliveryAttempt` increment, so `maxDeliveryAttempts` never applied; and because each self-reclaim reset the entry's idle clock, a genuinely hung handler's entry was never released to a sibling. `unsubscribe()` now also waits for an in-flight reclaim pass before tearing down. This brings `@mastra/valkey-streams` in line with `@mastra/redis-streams`.

Behavior change: a subscription never redelivers to itself anymore, so a handler that hangs (never acks or nacks) is only recovered by a _different_ consumer in the group. In a single-consumer group that message stays pending until the process restarts. Set the new `inFlightTimeoutMs` option to have the subscription nack such a message on the handler's behalf after that long; the nack republishes with an incremented `deliveryAttempt`, so `maxDeliveryAttempts` still bounds retries. It defaults to `0` (disabled). The timeout settlement verifies ownership and settles in one atomic server-side step, so a sibling that has already reclaimed the entry is never acked out from under it.

```ts
import { ValkeyStreamsPubSub } from '@mastra/valkey-streams';

const pubsub = new ValkeyStreamsPubSub({
  url: process.env.VALKEY_URL,
  // Give up on a handler that has neither acked nor nacked after 10 minutes
  // and retry it (bounded by maxDeliveryAttempts).
  inFlightTimeoutMs: 10 * 60 * 1000,
});
```
