---
'@mastra/core': minor
---

Add batching primitives to the PubSub abstraction.

**New options**

- `SubscribeOptions.batch` (`SubscribeBatchOptions`): opt in to coalesced delivery on a per-subscriber basis. Fields: `maxSize`, `maxWaitMs`, `minIntervalMs`, `isImmediate`, `coalesce`, `maxBufferSize`, `overflow`.
- `EventEmitterPubSub` constructor accepts optional `EventEmitterPubSubOptions` with a `logger` for batched-delivery error diagnostics.

**Example**

```ts
import { EventEmitterPubSub } from '@mastra/core/events';

const pubsub = new EventEmitterPubSub();

await pubsub.subscribe(
  'agent-events',
  event => {
    // delivered in coalesced batches; the cb is still invoked once per event
  },
  {
    batch: {
      maxSize: 10, // flush once 10 events have queued
      maxWaitMs: 500, // ...or after 500ms, whichever comes first
    },
  },
);
```

**New exports**

- `SubscribeBatchOptions` type.
- `PubSub.supportsNativeBatching` — advertises whether an adapter honors `options.batch` internally.

**Behavior**

- `EventEmitterPubSub.supportsNativeBatching === true`. Batched subscribers receive coalesced delivery driven by an in-memory buffer governed by `maxSize` / `maxWaitMs` / `minIntervalMs` / `isImmediate` / `coalesce` / `overflow` / `maxBufferSize`.
- `EventEmitterPubSub.flush()` drains every batched subscriber buffer and waits for any pending nack redeliveries before resolving. Non-callback rejections surface through the configured `logger` instead of being swallowed.
- `CachingPubSub` is transparent to batching: it forwards `options` (including `batch`) to its inner PubSub and forwards `supportsNativeBatching` from the inner. Whether batching is honored depends entirely on the wrapped transport.

**Contract notes**

- `SubscribeBatchOptions.coalesce` must return a subset of its input array by reference identity. Returning freshly-constructed `Event` objects (even with matching `id`) is treated as a contract violation: the batching layer can't route `ack`/`nack` to original transport handles for manufactured events, so the entire batch is discarded and every original event is acked as dropped. If you need merged payloads, build them in the subscriber callback after delivery.
- `flush()` is best-effort: a successful resolution does not guarantee every subscriber callback succeeded. Per-event errors surface via the configured logger.
