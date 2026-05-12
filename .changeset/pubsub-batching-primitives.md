---
'@mastra/core': minor
---

Add batching primitives to the PubSub abstraction.

**New options**

- `SubscribeOptions.batch` (`SubscribeBatchOptions`): opt in to coalesced delivery on a per-subscriber basis. Fields: `maxSize`, `maxWaitMs`, `minIntervalMs`, `isImmediate`, `coalesce`, `maxBufferSize`, `overflow`, `subscriberId`.
- `EventEmitterPubSub` constructor accepts an optional `logger` for batched-delivery error diagnostics.

**New exports**

- `BatchPolicy` — pure policy engine deciding when a batch should flush.
- `AckHandleBuffer` — buffer used by native adapters to hold `(event, ack, nack)` triples between policy decisions.
- `SubscribeBatchOptions`, `DEFAULT_MAX_BUFFER_SIZE`.
- `PubSub.supportsNativeBatching` — advertises whether an adapter holds the batch internally.

**Behavior**

- `EventEmitterPubSub` is native: batches are held in an in-memory `AckHandleBuffer`.
- `CachingPubSub` provides a cache-backed batching path for non-native inner adapters using per-subscriber cursors persisted in the cache. Requires `options.batch.subscriberId`; `subscribe()` throws if it's missing.
- `CachingPubSub.flush()` now drains all in-flight cache-backed batches before delegating to the inner adapter.
- `EventEmitterPubSub.flush()` surfaces non-callback buffer rejections (e.g. from a throwing `coalesce`) through the configured `logger` instead of swallowing them.
- `EventEmitterPubSub.flush()` now loops drain-buffers + wait-for-nacks until both are stable. A batched cb that nacks an event schedules a redelivery, which lands back in the batch buffer; previously that redelivery could be left stranded after `flush()` returned.
- `CachingPubSub` rehydrates pending indices on subscribe and emits a single aggregated warning when one or more rehydrated indices have no matching cached event (orphaned after eviction or TTL).

**Notes**

- `flush()` is best-effort: a successful resolution does not guarantee every subscriber callback succeeded. Per-event errors surface via the configured logger.
- When sharing a cache across multiple `CachingPubSub` instances, set a distinct `keyPrefix` per instance — pending lists and per-subscriber cursors are namespaced by `${keyPrefix}${topic}:batch:${subscriberId}:...` and collisions would cause one subscriber to resume from another's cursor.
- `subscribeWithReplay` / `subscribeFromOffset` do not support `options.batch`. Combining replay with batching is out of scope for this primitive.
- Cache-backed batching treats the in-memory pending list as authoritative within a single process. The persisted pending list is best-effort — under concurrent enqueue + flush, the persisted list may lag in-memory state by one in-flight event. On hard crash before the next successful flush, that event may be missing from rehydration even though it remains in the event log.
- `CachingPubSub.publish` leaves `event.index` undefined when the cache counter increment fails (rather than defaulting to `0`, which would corrupt cursors on repeated failures). Subscribers reading `event.index` from `CachingPubSub`-published events must handle `undefined`.
- `SubscribeBatchOptions.coalesce` must return a subset of its input array by **reference identity**. Returning freshly-constructed `Event` objects (even with matching `id`) is treated as a contract violation: the batching layer can't route `ack`/`nack` to original transport handles for manufactured events, so the entire batch is discarded and every original event is acked as dropped. If you need merged payloads, build them in the subscriber callback after delivery.
