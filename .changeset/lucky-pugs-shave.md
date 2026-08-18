---
'@mastra/core': patch
---

Stop writing run-local workflow events to the server cache.

Durable agents wrap `mastra.pubsub` in a `CachingPubSub`, so every publish was mirrored into the shared cache for replay. Per-run `workflow.events.v2.<runId>` watch events are only ever consumed in the publishing process, and their payloads accumulate step results — mirroring them filled shared stores (e.g. Redis) with lists no other instance could read.

`CachingPubSub` already skipped caching for publishes marked `localOnly`, but the caching layer sits above the proxy that sets that flag, so it never saw it. `CachingPubSubOptions` now accepts an optional `shouldCache?: (topic: string) => boolean` predicate, and the durable agent uses it to keep run-local topics out of the cache. Those events are still delivered live to subscribers; agent stream topics are unaffected and still replay as before.
