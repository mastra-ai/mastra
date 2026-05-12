# Signal Batching via PubSub — Technical Specification

**Status:** Draft v4
**Scope:** `packages/core/src/events`, `packages/core/src/agent`, `packages/core/src/loop`, `pubsub/redis-streams`, `pubsub/google-cloud-pubsub`, durable-agent run registry, MastraCode Unix-socket transport.

**Changes from v3:**

- **`BatchingPubSub` removed.** There is no separate wrapper class.
- **`CachingPubSub` absorbs batching for non-native adapters.** The cache is already the durability layer for transports without a native broker; `CachingPubSub.subscribe()` honors `options.batch` and uses cache cursors instead of an in-memory event buffer.
- **`EventEmitterPubSub` now natively supports batching.** As a strictly in-process broker, an in-memory ack-handle buffer is exactly as durable as the process itself. No cache, no wrapper, no warnings.
- Adapter list simplifies to two camps: native (Redis, GCP, EventEmitter) and "needs `CachingPubSub`-with-`batch`" (UnixSocket, third-party).

---

## 1. Problem

Agent **signals** (introduced experimentally in `f0cecbe13a`, documented at `docs/src/content/en/docs/agents/signals.mdx`) deliver out-of-band context into a running agent. They enter via `Agent.sendSignal()`, get appended to the agent's message list at safe chunk boundaries (`text-end`, `reasoning-end`, `tool-result`, `finish`), and force the loop to continue with the new input.

In the current implementation, **every** signal interrupts the model at the very next safe boundary. This is fine when signals are rare. It breaks down when they aren't:

> A long generation is running. A file watcher producer is firing `<file-changed>` signals 3–4 times per second during a build. The user, meanwhile, sends one `<user-message>` "wait, also handle the auth case." The model is mid-way through a 2000-token response.

Today the model is re-prompted roughly every 250ms. Its context is rewritten on each iteration, its plan destabilizes, and per-token cost balloons because each "iteration" is a fresh model call with a growing input. There is no `minIntervalMs`, no `maxWaitMs`, no `coalesce` — just "drain everything every time."

Two further frictions:

- There are **two parallel implementations** of signal delivery (regular agent stack `stack/01`…`stack/04` uses in-process `Map`s in `AgentThreadStreamRuntime`; durable agent stack `stack/04-agent-send-signal`…`stack/06` uses the `PubSub` abstraction). Adding batching to one wouldn't apply to the other.
- The agent loop currently owns *both* "is it structurally safe to drain?" (a real concern only it can answer) and "is it strategically wise to drain?" (a producer/consumer cadence question that has nothing to do with the loop).

## 2. Solution summary

Introduce **opt-in, per-subscription batching as a first-class capability of the `PubSub` abstraction**, and migrate both signal stacks to deliver through pubsub.

The PubSub gains a `batch` option on `subscribe()`:

```ts
await pubsub.subscribe(topic, cb, {
  group: 'active-run',
  batch: { maxSize: 8, maxWaitMs: 1500, minIntervalMs: 500, isImmediate, coalesce },
});
```

Subscribers that omit `batch` see no behavior change. Subscribers that pass `batch` receive their callback invocations grouped according to the policy.

Each adapter either:

1. **Supports batching natively.** It already has a durable retention mechanism for unacked events — the network broker (Redis, GCP) or the process itself (`EventEmitterPubSub`, which is strictly in-process so the buffer's durability matches the rest of the process). It integrates a thin `AckHandleBuffer` internally and advertises `supportsNativeBatching = true`.
2. **Does not.** The adapter is a thin transport with no retention (`UnixSocketPubSub`, third-party HTTP/SSE bridges, etc.). For these, the user wraps with `CachingPubSub`, which already provides durable retention via `MastraServerCache` and now also offers batching by holding cache cursors instead of events.

There is no separate `BatchingPubSub` class. Batching state lives where the event retention lives: in the broker for native adapters, in the cache for non-native ones, in `EventEmitterPubSub`'s own ack-handle buffer for in-process.

The agent loop keeps the structural boundary check (`text-end`, `tool-result`, etc.). The cadence question moves to pubsub. The two parallel queues (`AgentThreadStreamRuntime.#pendingSignalsByThread` and `run-registry.signalQueue`) are deleted; both stacks publish to the same topic scheme `agent-signals:{resourceId}:{threadId}` and receive via a small **signal-saving subscriber** that mutates the run's `messageList` and flips a `signalsDirty` flag. The loop, at its next safe boundary, observes the flag and continues.

Result: one cadence policy across in-process and broker transports, identical behavior between regular and durable agents, no policy duplication, and explicit opt-in so default behavior is unchanged.

---

## 3. Category: PubSub core API changes

### 3.1 `Event` and `EventCallback` stay as-is

```ts
type Event = {
  type: string;
  id: string;
  data: any;
  runId: string;
  createdAt: Date;
  index?: number;
  deliveryAttempt?: number;
};

type EventCallback = (event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>) => void;
```

No payload-shape changes. Signals are serialized into `event.data` as the existing `CreatedAgentSignal` DB form, with two new optional flags carried alongside:

```ts
// What the signal-saving producer publishes:
await pubsub.publish(topic, {
  type: 'agent-signal',
  data: {
    signal: signal.toDBMessage(),      // existing shape
    immediate: signal.type === 'user-message' || explicitImmediate === true,
    coalesceKey: 'file-changed:src/a.ts', // optional
  },
  runId: enclosingRunId ?? '',
});
```

### 3.2 New `SubscribeBatchOptions`

In `packages/core/src/events/types.ts`:

```ts
export interface SubscribeBatchOptions {
  /**
   * Maximum events held before forcing a flush.
   * When the buffer reaches this size the callback fires for every queued
   * event in order (callback is invoked once per event, back-to-back).
   */
  maxSize?: number;

  /**
   * Maximum wall time (ms) the oldest event may sit in the buffer.
   * The timer starts when the buffer transitions empty → non-empty.
   */
  maxWaitMs?: number;

  /**
   * Minimum wall time (ms) between consecutive batch deliveries to this
   * subscriber. Even if maxSize / maxWaitMs would fire, the buffer holds
   * until this interval has elapsed since `lastDeliveredAt`.
   */
  minIntervalMs?: number;

  /**
   * If true for an event, the buffer flushes immediately on publish, in
   * order, including the immediate event. Per-event escape hatch.
   */
  isImmediate?: (event: Event) => boolean;

  /**
   * Applied to the batch before delivery. Use to merge or drop superseded
   * events (e.g. coalesce N "file-changed" signals on the same path into
   * the latest one). Must preserve event ordering for events it keeps.
   */
  coalesce?: (events: Event[]) => Event[];

  /**
   * Maximum events the buffer may hold before overflow handling kicks in.
   * Defaults to 256. Events flagged immediate are never dropped on overflow.
   */
  maxBufferSize?: number;

  /**
   * Overflow strategy. Defaults to 'coalesce-or-drop-oldest', which runs
   * `coalesce` first (if provided) and then drops oldest if still over budget.
   */
  overflow?: 'drop-oldest' | 'drop-newest' | 'coalesce-or-drop-oldest';

  /**
   * Stable subscriber identifier. Required when batching is used with a
   * cache-backed adapter (CachingPubSub) so cursors can be reattached after
   * a restart. Optional for native adapters that don't need a cache cursor.
   */
  subscriberId?: string;
}
```

Extend `SubscribeOptions`:

```ts
export interface SubscribeOptions {
  group?: string;
  batch?: SubscribeBatchOptions;
}
```

`group` already provides consumer-group / fan-out semantics across every existing adapter — no separate "consumer group" concept needs to be added for the idle-fallback subscriber in §5.

### 3.3 Per-event invocation, not per-batch

The callback signature does **not** change. A batch of five events delivered together produces five consecutive `cb(event, ack, nack)` invocations, in order, on the same event-loop tick. Rationale:

- Every existing subscriber works unchanged.
- The signal-saving callback wants per-signal `messageList.add()` calls anyway — array-shaped batches would just fan back out.
- `ack`/`nack` per event preserves redelivery semantics on adapters that support them (Redis Streams `XACK`, GCP Pub/Sub ack handle).

The observable batching property — *temporal grouping* — is fully captured by callback timing, not signature.

### 3.4 Base-class capability flag

Update `PubSub`:

```ts
export abstract class PubSub {
  abstract publish(...): Promise<void>;
  abstract subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void>;
  abstract unsubscribe(...): Promise<void>;
  abstract flush(): Promise<void>;

  /**
   * Implementations declare whether their `subscribe()` honors `options.batch`
   * natively. When false, callers that need batching must wrap with
   * `CachingPubSub`, which provides batching via cache-backed cursors.
   *
   * Defaults to false. Implementations override and return true once they
   * integrate `AckHandleBuffer` (or equivalent).
   */
  get supportsNativeBatching(): boolean {
    return false;
  }

  // ... existing getHistory, subscribeWithReplay, subscribeFromOffset unchanged
}
```

Like `supportedModes`, this is a capability advertisement. Callers do not generally branch on it; the wiring layer in `@mastra/core` checks it once when constructing the pubsub graph and either passes `batch` through (native) or asks the user to install `CachingPubSub` (non-native).

### 3.5 One policy engine, two integration sites

Batching policy is a pure function of time and queue state. The same policy implementation runs in two places:

1. Inside an adapter that has its own retention (native path).
2. Inside `CachingPubSub` (cache-backed path).

The shared piece is `BatchPolicy`:

```ts
// packages/core/src/events/batch-policy.ts
export interface BatchPolicyDeps {
  now: () => number;
  setTimeout: (cb: () => void, ms: number) => any;
  clearTimeout: (handle: any) => void;
}

export class BatchPolicy {
  constructor(opts: SubscribeBatchOptions, deps?: BatchPolicyDeps);

  /** Caller invokes this every time a new event lands. Returns the action to take. */
  onEnqueue(event: Event): 'flush-now' | 'schedule' | 'wait';

  /** Caller invokes this when the deadline timer fires. */
  onTimerFire(): 'flush' | 'reschedule';

  /** Caller invokes this after a successful flush. Resets timers + lastDeliveredAt. */
  onFlushed(): void;

  /** Pure helper for `maxBufferSize` + `overflow`. */
  applyOverflow<T>(items: T[], isImmediate: (t: T) => boolean): { keep: T[]; dropped: T[] };

  /** Pure helper for `coalesce`. */
  coalesce(events: Event[]): Event[];
}
```

`BatchPolicy` knows nothing about where events live. It works on counts and timestamps. Adapters that integrate it provide their own queue representation.

### 3.6 The two integration sites

**Site A — `AckHandleBuffer` (used by native adapters):**

```ts
// packages/core/src/events/ack-handle-buffer.ts
// Each entry: { event, ack, nack, isImmediate }.
// On flushNow: iterate entries, invoke cb(event, ack, nack) in order,
//              call BatchPolicy.onFlushed().
// Holds: event references (cheap; the actual durability is upstream).
```

- For `RedisStreamsPubSub`: `event` is the parsed record; `ack` is `XACK`; `nack` is "do nothing, let PEL reclaim."
- For `GoogleCloudPubSub`: `event` is the parsed message; `ack` is `message.ack()`; `nack` is `message.nack()`.
- For `EventEmitterPubSub`: `event` is the in-process object; `ack` and `nack` are no-ops (no redelivery; the process is the broker). Durability matches the process — no worse than the rest of the application.

**Site B — `CachingPubSub.subscribe(..., { batch })` (used for non-native adapters):**

```ts
// In CachingPubSub.subscribe(topic, cb, { batch, group, subscriberId }):
// 1. Subscribe to the inner adapter; on each delivery the event was already
//    cached by `CachingPubSub.publish` (existing behavior). Inner ack is
//    called immediately — durability now belongs to the cache.
// 2. Append event.index to a per-(topic, subscriberId) pending-cursor list
//    held in the cache.
// 3. Run BatchPolicy.onEnqueue with the event; flush per its decision.
// 4. On flush: read events from the cache by their indices, run coalesce,
//    invoke `cb(event, undefined, undefined)` for each, then advance the
//    per-subscriber cursor in the cache.
//
// On restart: rehydrate pending cursors from the cache; resume.
```

`CachingPubSub` already writes every event to its cache with a monotonic `index` *before* publishing to the inner transport. That guarantees the cache has the event by the time the subscriber sees it. The batching addition is small: a per-subscriber cursor and the policy engine.

No new `BatchingPubSub` class. No fallback in-memory mode for non-native transports — if you need batching on a transport without a broker, you use `CachingPubSub` for the same reason you'd use it for replay: you need retention.

---

## 4. Category: per-adapter behavior

The two camps:

| Adapter | `supportsNativeBatching` | Where retention lives | Where batching lives |
| --- | --- | --- | --- |
| `RedisStreamsPubSub` | `true` | Redis stream (PEL) | adapter-internal `AckHandleBuffer` |
| `GoogleCloudPubSub` | `true` | GCP server (outstanding pool + ack deadline) | adapter-internal `AckHandleBuffer` |
| `EventEmitterPubSub` | `true` | the process itself | adapter-internal `AckHandleBuffer` |
| `UnixSocketPubSub` | `false` | n/a (raw transport) | wrap with `CachingPubSub` → cache cursors |
| `CachingPubSub` (wrapper) | `true` if inner is native; otherwise honors `batch` itself via cache cursors | inner adapter or its own cache | passthrough or cache-backed |
| Third-party `PubSub` | `false` by default | n/a | wrap with `CachingPubSub` |

### 4.1 `RedisStreamsPubSub` (native, durable)

Today (`pubsub/redis-streams/src/index.ts:335`):

```ts
result = await sub.readClient.xReadGroup(sub.group, sub.consumer, [{ key: sub.streamKey, id: '>' }], {
  COUNT: 10,
  BLOCK: this.#blockMs,
});
```

`COUNT` and `BLOCK` are hardcoded. When `options.batch` is set, derive them per subscription:

```ts
const desiredCount = Math.min(options.batch.maxSize ?? 10, 1000);
const desiredBlock = options.batch.maxWaitMs ?? this.#blockMs;
```

The event itself **stays in the Redis stream** until XACK. The adapter's per-subscription state is an `AckHandleBuffer` holding `{ messageId, isImmediate }` entries plus a `BatchPolicy` instance. On flush: invoke `cb(event, ack, nack)` in order, where `ack` performs `XACK` for that message ID.

What lives in `AckHandleBuffer` (i.e. not natively expressed by Redis):

1. `minIntervalMs` — per-subscription `lastDeliveredAt` gate inside the read loop.
2. `isImmediate` — inspect each returned record; if any matches, fire the whole returned batch immediately.
3. `coalesce` — run between read and `cb` invocation. Coalesced-out messages are XACKed without being delivered.
4. `overflow` is a non-issue at the broker level (`maxStreamLength` MAXLEN trim). The in-memory ack-handle list is bounded by `desiredCount`.

Crash semantics: process dies between XREADGROUP and XACK → pending entries reclaimed via `XAUTOCLAIM` (existing behavior) → redelivered on next read. **Zero loss.**

### 4.2 `GoogleCloudPubSub` (native, durable)

GCP's subscriber-side flow control plus delayed-ack covers everything we need:

- **`flowControl.maxOutstandingMessages`** — how many messages the SDK will hold before pausing intake. Maps to `maxSize` with headroom.
- **`MaxExtensionPeriod`** / **`MaxExtension`** — the SDK auto-extends ack deadlines while we hold a message. As long as buffer hold time stays below `MaxExtension`, GCP does not redeliver.
- **Delayed `Message.ack()`** — we don't ack in the SDK callback. We hold the `Message` reference in `AckHandleBuffer` and call `ack()` when the policy fires.

Mapping:

| Policy knob | GCP mechanism |
| --- | --- |
| `maxSize` | `flowControl.maxOutstandingMessages` (server-enforced) |
| `maxWaitMs` | delayed-ack window; cap at `MaxExtension × 0.8` |
| `minIntervalMs` | `lastDeliveredAt` gate in `AckHandleBuffer` |
| `isImmediate` | flush-on-arrival when predicate matches |
| `coalesce` | run before invoking `cb`; ack the coalesced-out `Message`s without invoking `cb` |
| `overflow` | server-enforced via `flowControl`; in-process ack-handle list cannot exceed it |

Set `supportsNativeBatching = true`. Set `subscriberOptions.flowControl.maxOutstandingMessages = max(maxSize * 2, default)` on subscription creation (×2 for headroom while a batch is in flight). Warn at subscription time if `maxWaitMs > MaxExtension * 0.8`.

Crash semantics: process dies before ack → GCP redelivers after ack deadline → `AckHandleBuffer` reconstructs from the redelivered stream. **Zero loss.**

### 4.3 `EventEmitterPubSub` (native, in-process)

This adapter is strictly in-process; producers, subscribers, and any "buffer" live in the same Node process. The only failure mode for an in-memory buffer here is "the process crashes", which also kills every publisher and subscriber. There is no durability gap to close.

Implementation:

- Set `supportsNativeBatching = true`.
- On `subscribe(topic, cb, { batch })`: create an `AckHandleBuffer` keyed by `cb`. The internal listener pushes each delivered event into the buffer; the buffer's `BatchPolicy` decides when to flush.
- Ack/nack are no-ops at this layer (no redelivery on a synchronous emitter). The buffer still exposes them as no-op callbacks so the subscriber API is uniform across adapters.
- `flush()` drains every per-subscriber buffer before delegating to the underlying emitter's existing flush.

That's the entire change to this file — \~80 LoC. No cache. No warnings. No wrapper.

### 4.4 `UnixSocketPubSub` (non-native, cross-process)

This is a raw socket transport with no retention. If the consumer process crashes mid-batch with events held in RAM, those events are gone — the coordinator has already sent them and has no way to know they weren't processed.

Solution: wrap with `CachingPubSub`. The cache (whatever `MastraServerCache` is configured) becomes the retention layer. The natural choice for MastraCode is a file-backed cache rooted at the harness's working directory; the consumer process can reattach cursors after restart.

`UnixSocketPubSub` itself reports `supportsNativeBatching = false` and is unchanged. `CachingPubSub` wraps it and honors `batch`.

### 4.5 `CachingPubSub`

Two responsibilities now:

1. **Retention + replay** (existing): every `publish` writes to the cache with a monotonic `index` before forwarding to the inner adapter; `subscribeWithReplay` and `subscribeFromOffset` use the cache to deliver historical events.
2. **Batching for non-native inners** (new): when `subscribe(topic, cb, { batch })` is called and the inner reports `supportsNativeBatching === false`, `CachingPubSub` runs the batching loop itself using cache cursors.

Behavior:

```ts
async subscribe(topic, cb, options) {
  if (!options?.batch) {
    // unchanged: pass through to inner
    return this.inner.subscribe(topic, cb, options);
  }

  if (this.inner.supportsNativeBatching) {
    // inner can do it natively — pass batch through
    return this.inner.subscribe(topic, cb, options);
  }

  // cache-backed batching path
  const policy = new BatchPolicy(options.batch);
  const subscriberId = options.batch.subscriberId
    ?? throwForMissingId();   // required for cache-backed batching

  // Rehydrate any pending cursors from the cache (post-restart safety).
  const pending = await this.cache.getPending(this.region(topic, subscriberId));

  await this.inner.subscribe(topic, async (event, innerAck) => {
    // event was already cached by `this.publish` before the inner saw it.
    // Ack the inner immediately — retention now belongs to the cache.
    await innerAck?.();
    pending.push(event.index!);
    await this.cache.appendPending(this.region(topic, subscriberId), event.index!);

    const action = policy.onEnqueue(event);
    if (action === 'flush-now') await this.flushPending(topic, subscriberId, cb, policy, pending);
    // 'schedule' / 'wait' handled by policy's internal timer wiring
  }, { group: options.group });

  policy.bindFlushHandler(() => this.flushPending(topic, subscriberId, cb, policy, pending));
}

private async flushPending(topic, subscriberId, cb, policy, pending) {
  const cursors = pending.splice(0);                // take everything queued
  const events = await this.cache.readByIndex(this.region(topic, subscriberId), cursors);
  const coalesced = policy.coalesce(events);
  for (const ev of coalesced) {
    try {
      await cb(ev);                                 // ack/nack not exposed: success advances cursor
    } catch (err) {
      // cb failed — re-queue this and remaining unprocessed cursors
      pending.unshift(...cursors.slice(coalesced.indexOf(ev)));
      return;
    }
  }
  await this.cache.advanceCursor(this.region(topic, subscriberId), Math.max(...cursors));
  policy.onFlushed();
}
```

`subscriberId` is **required** when `batch` is set on a non-native inner, because cursor reattachment after restart depends on a stable identity. Throw with a clear error message at subscribe time if missing.

`subscribeWithReplay` continues to call the user `cb` for cached historical events first, then live events. When `batch` is provided to `subscribeWithReplay`, replayed events flow through the same cache-backed batching path; `isImmediate` is treated as `false` for replay.

### 4.6 Third-party `PubSub` implementations

Default: `supportsNativeBatching = false`. Users wrap with `CachingPubSub` and provide a `subscriberId` to get batching. Third parties wanting native efficiency override the getter and integrate `AckHandleBuffer` themselves.

Same back-compat shape as `supportedModes` (defaults to `['pull']`, overridable). No third-party adapter breaks.

---

## 5. Category: topic scheme and subscription roles

### 5.1 Topic key

```
agent-signals:{resourceId}:{threadId}
```

One topic per logical thread. Identical across regular and durable stacks; the only difference is which subscriber is registered.

### 5.2 Subscription roles

Two `group`s are used per thread topic:

1. `active-run` **group** — when an agent run starts, the runtime registers a subscriber in this group. Competing-consumer semantics within the group ensure that if some pathological case produces two runs claiming the same thread, only one receives each event.
2. `idle-fallback` **group** — registered for the lifetime of the resource. Receives events that the `active-run` group did not consume (i.e. when no active run is subscribed).

GCP Pub/Sub note: maps to two subscriptions on the same topic. Redis Streams note: maps to two consumer groups on the same stream key. EventEmitter note: implemented in the existing `groups`/`fanoutWrappers` machinery in `event-emitter.ts`.

`subscriberId` for `CachingPubSub`-batched paths is `active-run:${runId}` (deterministic, reattachable) and `idle-fallback:${resourceId}`.

### 5.3 Idle-start flow

```
sendSignal()
   → pubsub.publish(`agent-signals:R:T`, ...)

If active-run subscriber exists in group 'active-run':
   → batch policy applies (adapter-internal or CachingPubSub-internal)
   → signal-saving cb → messageList.add() → signalsDirty=true
   → loop continues at next safe boundary

If no active-run subscriber:
   → idle-fallback subscriber receives event
   → checks agent.ifIdle.streamOptions
   → starts new run with the signal(s) as input
   → new run registers in 'active-run' group; any subsequent events flow there
```

This replaces today's `#pendingIdleSignalsByThread: Map<...>` in `AgentThreadStreamRuntime`. The map is deleted entirely.

### 5.4 What replaces `#pendingSignalsByThread` and `#pendingIdleSignalsByThread`

Both deleted. The pubsub topic *is* the queue. `AgentThreadStreamRuntime` retains only:

- `#threadRunsById` — run-lifecycle bookkeeping
- `#activeThreadRunIds` — which run owns which thread
- `#threadRunSubscribers` — for `subscribeToThread()` (the client-facing observation API, *unrelated* to signal delivery)

---

## 6. Category: framework wiring

### 6.1 No auto-wrapping

The framework does **not** silently wrap user-provided pubsub instances. The contract is explicit:

- If `pubsub.supportsNativeBatching === true`, batching just works.
- If `false`, and any agent has `signalBatching` configured, throw at `Mastra` construction time with:

  > Your pubsub adapter `<name>` does not natively support batching. Wrap it with `CachingPubSub` and provide a cache to enable batching:
  >
  > ```ts
  > new Mastra({ pubsub: new CachingPubSub(myAdapter, cache) })
  > ```

Rationale: silent wrapping hides a real durability + configuration choice. The user knows whether they have a cache available and what kind. `CachingPubSub` is already public API and already used elsewhere for replay; reusing it for batching is consistent.

Default `pubsub` (when user provides none) is `EventEmitterPubSub`, which is native — batching works out of the box for local development.

### 6.2 Per-Agent configuration surface

New optional field on `Agent` config:

```ts
interface AgentConfig {
  // ... existing fields
  signalBatching?: {
    maxSize?: number;
    maxWaitMs?: number;
    minIntervalMs?: number;
    isImmediate?: (signal: CreatedAgentSignal) => boolean;
    coalesce?: (signals: CreatedAgentSignal[]) => CreatedAgentSignal[];
    maxBufferSize?: number;
    overflow?: 'drop-oldest' | 'drop-newest' | 'coalesce-or-drop-oldest';
  };
}
```

Two ergonomic improvements over raw `SubscribeBatchOptions`:

- `isImmediate` and `coalesce` receive `CreatedAgentSignal` objects, not raw `Event`s. The runtime adapts them when registering the subscription.
- A default `isImmediate` is always installed that returns `true` for `signal.type === 'user-message'`, ensuring human input is never silently buffered. User-supplied `isImmediate` runs *in addition*; either returning true triggers immediate flush.

### 6.3 Mastra-level default

Optional `signalBatching` on `Mastra` config, used as a default for any agent that does not override it. Final precedence: per-`sendSignal` `immediate: true` > per-agent config > per-Mastra default > built-in default (`{ maxSize: 1 }` — i.e. no batching, current behavior).

### 6.4 Per-call escape hatch

`sendSignal()` accepts an optional `immediate: true` flag. Sets `event.data.immediate = true` at publish time, triggering the buffer's flush-on-publish path regardless of agent config.

---

## 7. Category: signal-saving subscriber

A small new module `packages/core/src/agent/signal-saving-subscriber.ts`. Its job is to translate a delivered signal event into:

1. `messageList.add(signal.toLLMMessage(), 'input')` — makes the signal visible to the next model call
2. `safeEnqueue(streamController, signal.toDataPart())` — surfaces the signal to clients observing the stream
3. `storage.persistMessage(signal.toDBMessage())` — durable record with `role: 'signal'`
4. `run.signalsDirty = true` — wakes the loop at its next safe boundary

The runtime registers it once per run:

```ts
await pubsub.subscribe(
  `agent-signals:${resourceId}:${threadId}`,
  createSignalSavingSubscriber({ run, messageList, storage, controller }),
  {
    group: 'active-run',
    batch: {
      ...adaptAgentSignalBatchingToPubSubOptions(agent.signalBatching),
      subscriberId: `active-run:${run.id}`,
    },
  },
);
```

`adaptAgentSignalBatchingToPubSubOptions` translates the `CreatedAgentSignal`-shaped helpers to `Event`-shaped ones.

Persist-then-notify ordering: the subscriber must `await storage.persistMessage(...)` before setting `signalsDirty = true`. `messageList.add()` happens in-memory before persist; if persist fails, the in-memory addition is rolled back and (for adapters where ack/nack is exposed) the event is `nack`'d for redelivery.

For the cache-backed path inside `CachingPubSub`, "redelivery on failure" is automatic: a thrown error from `cb` leaves the cursor where it is, so the event reappears on next flush.

---

## 8. Category: agent loop changes

Today (`llm-execution-step.ts:553`):

```ts
if (['text-end', 'reasoning-end', 'tool-result', 'finish'].includes(chunk.type)) {
  const interjectedSignals = drainPendingSignals?.(runId) ?? [];
  if (interjectedSignals.length > 0) {
    return { collectedChunks, interjectedSignals };
  }
}
```

After:

```ts
if (['text-end', 'reasoning-end', 'tool-result', 'finish'].includes(chunk.type)) {
  if (run.signalsDirty) {
    run.signalsDirty = false;
    return { collectedChunks, signalsInterjected: true };
  }
}
```

The loop no longer pulls signals — by the time it observes `signalsDirty`, the subscriber has already appended messages to `messageList` and persisted them. The loop's only job is to acknowledge new input arrived and continue.

In `agentic-loop/index.ts:84`, the same flag-check replaces the explicit `drainPendingSignals(runId)` call between iterations. The `drainPendingSignals` parameter on `prepare-stream`'s prop types is removed.

### 8.1 Run-completion flush

When a run terminates (success or error), the runtime calls `pubsub.flush()` *before* unregistering the active-run subscriber. This drains any in-buffer events into the subscriber (last chance to persist them), then the unsubscribe takes effect and the idle-fallback subscriber picks up any newly-published events.

`PubSub.flush()` already exists on the abstract class. Each adapter's `flush()` drains its per-subscriber `AckHandleBuffer` (or, for `CachingPubSub`, the cache-backed pending list) in addition to its existing flush behavior.

---

## 9. Category: durable stack alignment

Today, `packages/core/src/agent/durable/run-registry.ts` has `enqueueSignal(runId, signal)` which pushes onto a per-run `signalQueue: CreatedAgentSignal[]`. Delivery is via the existing `EventEmitterPubSub` / Unix-socket / Redis pubsub used for durable-stream chunks, on durable-specific topics.

Change: `enqueueSignal` becomes a thin `pubsub.publish('agent-signals:R:T', ...)` call. The same signal-saving subscriber registered for regular agents works here. The durable run's pubsub instance is whatever was injected at `Mastra` construction time — `EventEmitterPubSub` for in-process, `CachingPubSub(UnixSocketPubSub, cache)` for cross-process MastraCode, `RedisStreamsPubSub` for production.

Net effect: the two stacks share **one** delivery path. The regular vs. durable distinction now reduces to "does the run live in this process or another one?" — a transport question, fully encapsulated by which `PubSub` adapter is wired in.

---

## 10. Category: edge cases

### 10.1 Ordering

- `EventEmitterPubSub`: synchronous emit preserves publish order per topic. ✅
- `RedisStreamsPubSub`: per-stream FIFO, with documented exception that `nack` redelivery re-publishes with a new ID and breaks strict order (existing behavior, orthogonal to batching). `AckHandleBuffer` does not reorder; `coalesce` must preserve ordering for events it keeps.
- `GCP Pub/Sub`: ordering only guaranteed with ordering keys. Set the ordering key to the topic key `agent-signals:R:T` on publish so per-thread order holds.
- `UnixSocketPubSub`: framed messages preserve order on a single connection. `CachingPubSub` writes to cache in publish order and reads back by index, so the cache-backed batching path is order-preserving end-to-end.

### 10.2 Buffer overflow

Default `maxBufferSize = 256`. With typical signal size \~1KB and signals being mostly small XML wrappers, this caps in-memory cost (for `AckHandleBuffer`) at \~256KB per active thread. For the cache-backed path, the budget is on the cache region — events past `cursor` can be aggressively trimmed.

`isImmediate` events bypass overflow and never get dropped. If overflow happens with a `coalesce` provided, run `coalesce` first; if still over budget, drop oldest non-immediate events. Emit a `warn`-level log per overflow with topic and dropped count.

### 10.3 Late-arriving `isImmediate` during an active batch window

Buffer has 4 `<file-changed>` queued at t=900ms (maxWaitMs flushes at t=2400ms). User sends `<user-message>` at t=1500ms → `isImmediate` true → buffer flushes immediately at t=1500ms with all 5 events in publish order. `lastDeliveredAt` updates to 1500; `minIntervalMs` gate now applies forward from there.

### 10.4 Same-thread, different-agent

Today (`thread-stream-runtime.ts:391`) signals are only drained into runs of the *same agent*. Signals for Agent A delivered while Agent B owns the thread fall through to idle-start. Pubsub preserves this: the active-run subscriber's callback predicates on `agentId` and `nack`s mismatched signals (or, for the cache-backed path, throws so the cursor doesn't advance); mismatched events fall through to the idle-fallback group which checks `ifIdle.streamOptions` per agent and may start a fresh Agent A run.

Alternative: encode `agentId` into the `group` (`active-run:agentA`) so mismatches never arrive at the wrong subscriber in the first place. Cleaner; requires more groups per topic. Defer to implementation.

### 10.5 Replay through `CachingPubSub`

`subscribeWithReplay` flows historical events into the batching policy if `batch` is configured. Replay events have non-zero `index` already; `coalesce` can use that. `isImmediate` is forced to `false` for replay.

### 10.6 Test determinism

`BatchPolicy` accepts `BatchPolicyDeps` injection (`now`, `setTimeout`, `clearTimeout`) so tests use `vi.useFakeTimers()` deterministically. `AckHandleBuffer` and the `CachingPubSub` cache-backed integration both propagate the same deps. `CachingPubSub` tests use an in-memory `MastraServerCache` to exercise the cursor-advance path without a real backend. Pattern matches existing `BatchPartsProcessor` tests.

### 10.7 Observability

Emit a debug log per batch delivery:

```
{ topic, subscriberId, batchSize, oldestAgeMs, droppedOnOverflow, coalescedFrom, path: 'native' | 'cache-backed' }
```

Without this, "why didn't my signal arrive?" is unanswerable. `debug` level by default; promote to `info` if the framework detects sustained overflow.

### 10.8 `ack`/`nack` interaction with batching

Two paths:

- **Native (`AckHandleBuffer`)** — stores `(eventRef, ack, nack)` triples and invokes `cb(event, ack, nack)` at flush time. The original transport ack handles are exposed to user `cb`. Ack-deadline pressure is real and addressed in §4.1 (Redis `reclaimIdleMs` / PEL) and §4.2 (GCP `MaxExtension`). For `EventEmitterPubSub`, ack/nack are no-ops.
- **Cache-backed (`CachingPubSub`)** — acks the *inner* transport on enqueue (the event is now in the cache). User `cb` is invoked with `(event, undefined, undefined)` — successful `cb` return advances the cache cursor; a thrown error / rejected promise leaves the cursor where it is (event redelivered next flush).

Two non-obvious consequences:

1. **Ack deadline pressure (Redis, GCP only).** `AckHandleBuffer` caps `maxWaitMs` at a fraction of the adapter's deadline and warns on excess.
2. **Partial-batch failure.** Per-event semantics, achieved differently per path:
   - Native: earlier events already acked via `cb`'s `ack()`; later events fall to `nack`/redelivery.
   - Cache-backed: cursor advances only past events whose `cb` resolved; failed events reappear on next flush.

### 10.9 Durability guarantees per transport

| Transport | Path | What survives a crash | What's lost |
| --- | --- | --- | --- |
| `RedisStreamsPubSub` | native | All unacked events (PEL + `XAUTOCLAIM`) | Nothing |
| `GoogleCloudPubSub` | native | All unacked events (server redelivers past ack deadline) | Nothing |
| `EventEmitterPubSub` | native (in-process) | Nothing — but everything else in the process also dies, so this is not a *degradation* | Whatever was in flight (same as any non-persisted in-process state) |
| `UnixSocketPubSub` + `CachingPubSub` | cache-backed | All events past their cache write (synchronous before inner publish) | Events not yet written to cache (microseconds) |

The "in-process" durability of `EventEmitterPubSub` is intentional and correct. The buffer is not less durable than the run's `messageList`, the loop's local state, or the open HTTP connection serving the request — they all live and die together.

### 10.10 Cache region layout

For `CachingPubSub`-backed batching, each `(topic, subscriberId)` pair gets a region:

```
mastra:pubsub-batch:{topic}:{subscriberId}
  pending           → list of indices currently buffered
  cursor            → last-advanced index
  meta              → { firstQueuedAt, lastDeliveredAt }
```

The events themselves live in `CachingPubSub`'s existing event-log region (keyed by topic + index) — no duplication. Eviction policy: events at indices ≤ all subscribers' cursors are eligible for cleanup. The cache backend can also TTL them.

---

## 11. Non-goals

- Changing the `signal` storage role or XML wrapping.
- Removing the structural boundary check from `llm-execution-step.ts`. The chunk-type whitelist stays — it's about *safety*, not *cadence*.
- Cross-thread coalescing. Coalesce is per-topic.
- Cross-priority reordering inside a batch. FIFO within `coalesce`'s output.
- Migrating `progressThrottleMs` (background tasks) onto this primitive. Future follow-up; out of scope.
- A `subscribeBatch` API delivering `Event[]`. Per-event callback shape preserved.
- Introducing a `BatchingPubSub` wrapper class. The two integration sites (adapter-internal, `CachingPubSub`-internal) cover every transport without a third layer.

---

## 12. Open questions

1. `signalBatching` **config: per-Agent vs. per-Mastra?** Proposed: both, with Agent overriding. Confirm.
2. **Default** `maxBufferSize`**?** 256 is a guess. Needs to be informed by real burst patterns from MastraCode's file watcher.
3. **Agent-level vs. signal-type-level policy.** Should `signalBatching` support per-type sub-policies (e.g. `byType: { 'file-changed': { maxWaitMs: 2000 }, 'system-reminder': { maxWaitMs: 500 } }`)? Cleanest is probably "no, write a `coalesce` function" — but worth deciding before API freezes.
4. `CreatedAgentSignal`**-shaped** `coalesce`**/**`isImmediate` **vs.** `Event`**-shaped.** Proposed: signal-shaped at the Agent config layer, Event-shaped at the PubSub layer, with an adapter in between.
5. **Error message when `signalBatching` is configured but pubsub is non-native and uncached** — should the framework throw at `Mastra` construction, or at the first `subscribe` with `batch`? Construction is friendlier (fail fast); subscribe-time is more accurate (a user could configure `signalBatching` on an agent that never runs).

---

## 13. Rollout plan

Three independently reviewable PRs.

### PR 1 — PubSub batching primitives (additive, no behavior change)

Files:

- `packages/core/src/events/types.ts` — add `SubscribeBatchOptions`, extend `SubscribeOptions`.
- `packages/core/src/events/pubsub.ts` — add `supportsNativeBatching` getter (default false).
- `packages/core/src/events/batch-policy.ts` — new (policy engine with fake-clock deps).
- `packages/core/src/events/ack-handle-buffer.ts` — new (used by native adapters).
- `packages/core/src/events/event-emitter.ts` — integrate `AckHandleBuffer`; set `supportsNativeBatching = true`.
- `packages/core/src/events/caching-pubsub.ts` — add cache-backed batching path (only used when inner is non-native).
- `packages/core/src/events/batch-policy.test.ts` — exhaustive unit tests with fake clock.
- `packages/core/src/events/ack-handle-buffer.test.ts` — per-buffer tests.
- `packages/core/src/events/event-emitter.batch.test.ts` — native integration tests.
- `packages/core/src/events/caching-pubsub.batch.test.ts` — cache-backed integration tests.
- `packages/core/src/events/index.ts` — export new symbols.

Validation per `packages/core/AGENTS.md`:

- `pnpm --filter ./packages/core check`
- focused tests: `pnpm test --filter ./packages/core -- src/events`

No consumer changes. No `signalBatching` config yet. Pure addition.

### PR 2 — Port regular agent signals to PubSub

Files:

- `packages/core/src/agent/thread-stream-runtime.ts` — delete `#pendingSignalsByThread`, `#pendingIdleSignalsByThread`, public and private `drainPendingSignals`. Add pubsub publish + active-run subscriber registration on run-start. Add idle-fallback subscriber registration per resource.
- `packages/core/src/agent/signal-saving-subscriber.ts` — new.
- `packages/core/src/agent/agent.ts` — `signalBatching` config plumbing; throw at construction if `signalBatching` is set and `pubsub.supportsNativeBatching === false`.
- `packages/core/src/loop/types.ts` — remove `drainPendingSignals` prop; rely on `run.signalsDirty`.
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts` — drain site becomes dirty-flag check.
- `packages/core/src/loop/workflows/agentic-loop/index.ts` — between-iteration check becomes dirty-flag check.
- `packages/core/src/agent/workflows/prepare-stream/index.ts` and `stream-step.ts` — drop `drainPendingSignals` prop.

Validation:

- Existing `agent-signals.test.ts` must pass unmodified.
- New tests covering `maxWaitMs`, `minIntervalMs`, `isImmediate`, `coalesce` for regular agents.
- `pnpm --filter ./packages/core check`
- `pnpm test --filter ./packages/core -- src/agent src/loop`

### PR 3 — Port durable agent signals + adapter integration

Files:

- `packages/core/src/agent/durable/run-registry.ts` — replace `enqueueSignal` / `signalQueue` with pubsub publish to the same topic scheme.
- `pubsub/redis-streams/src/index.ts` — set `supportsNativeBatching = true`; honor `options.batch` by tuning `XREADGROUP COUNT`/`BLOCK`; integrate `AckHandleBuffer` for `minIntervalMs` / `isImmediate` / `coalesce`.
- `pubsub/google-cloud-pubsub/src/index.ts` — set `supportsNativeBatching = true`; set `flowControl.maxOutstandingMessages` from `maxSize`; hold `Message` refs in `AckHandleBuffer`; delay `Message.ack()` until policy flush; cap `maxWaitMs` ≤ `MaxExtension × 0.8` and warn on exceed.
- `mastracode/src/durable-streams/unix-socket-client.ts` — no changes; harness wires `CachingPubSub(UnixSocketPubSub, fileCache)` when batching is requested.
- Tests under `pubsub/redis-streams/src/` and `pubsub/google-cloud-pubsub/src/` covering batching behavior.

Validation:

- Native adapter tests for each.
- Durable-agent E2E.
- MastraCode cross-process integration tests.

### Rollback

Each PR is revertable independently. PR 1 is pure addition. PR 2 can be reverted if regular-agent signal tests regress. PR 3 can be reverted to in-process-only batching while the adapters are debugged.

In any deployment, setting `signalBatching: undefined` on the agent restores `maxSize: 1` (current) behavior even with all code in place.

---

## 14. Worked example

**Agent config:**

```ts
signalBatching: {
  maxSize: 8,
  maxWaitMs: 1500,
  minIntervalMs: 750,
  coalesce: signals => dedupeFileChangedByPath(signals),
}
```

**Pubsub:** `EventEmitterPubSub` (default; native; in-process).

**Timeline (ms):**

| t | Event | Buffer | Notes |
| --- | --- | --- | --- |
| 0 | run starts | — | active-run subscriber registers with the above options; `AckHandleBuffer` created |
| 100 | publish `file-changed: src/a.ts` | [1] | firstQueuedAt=100; timer set for t=1600 |
| 250 | publish `file-changed: src/b.ts` | [2] |  |
| 400 | publish `file-changed: src/a.ts` | [3] | will be coalesced with the first |
| 550 | publish `file-changed: src/c.ts` | [4] |  |
| 700 | publish `user-message: "also handle auth"` | [5] | default `isImmediate` matches → flush now |
| 700 | **batch delivered** | [] | coalesce returns 4 events (one per path + user-message); cb invoked 4× in order; `lastDeliveredAt=700` |
| 700 | signal-saving cb completes for each → `messageList.add()` ×4, persist ×4, `signalsDirty=true` | — |  |
| \~720 | loop hits next `text-end` boundary → reads `signalsDirty`, clears it, returns; iteration continues with new input | — |  |
| 900 | publish `file-changed: src/d.ts` | [1] | firstQueuedAt=900; timer at t=2400 but minIntervalMs floor is t=1450 → effective t=2400 |
| 1100 | publish `file-changed: src/d.ts` | [2] | will coalesce |
| 2400 | maxWaitMs elapsed, past minIntervalMs gate | — | **batch delivered**: 1 event after coalesce; lastDeliveredAt=2400 |
| \~2410 | loop continues at next safe boundary | — |  |

Net: model interrupted **twice** instead of seven times. User message preempted correctly. Duplicate path events coalesced. Loop code path unchanged from line one — only `signalsDirty` reads replace queue drains. No cache involved; the buffer is just a `Map` inside `EventEmitterPubSub`.
