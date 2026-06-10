# PubSub Batching — Spec (shipped scope)

**Status:** Shipped.

This document describes what landed under the `pubsub-batching` branch. Earlier drafts of this spec described a larger design — signal-stack migration to pubsub, native batching across Redis / GCP / Unix-socket adapters, cache-backed batching in `CachingPubSub`. None of that shipped on this branch. See §4 ("Future adapters") and §7 ("What did not ship") for what was cut and why.

For the public API surface as of this PR, the canonical source is the changeset (`.changeset/pubsub-batching-primitives.md`) and the types in `packages/core/src/events/`.

---

## 1. Problem

Agent **signals** (introduced experimentally in `f0cecbe13a`, documented at `docs/src/content/en/docs/agents/signals.mdx`) deliver out-of-band context into a running agent. They enter via `Agent.sendSignal()`, get appended to the agent's message list at safe chunk boundaries (`text-end`, `reasoning-end`, `tool-result`, `finish`), and force the loop to continue with the new input.

In the current implementation, **every** signal interrupts the model at the very next safe boundary. This is fine when signals are rare. It breaks down when they aren't:

> A long generation is running. A file watcher producer is firing `<file-changed>` signals 3–4 times per second during a build. The user, meanwhile, sends one `<user-message>` "wait, also handle the auth case." The model is mid-way through a 2000-token response.

Today the model is re-prompted roughly every 250ms. Its context is rewritten on each iteration, its plan destabilizes, and per-token cost balloons because each "iteration" is a fresh model call with a growing input. There is no `minIntervalMs`, no `maxWaitMs`, no `coalesce` — just "drain everything every time."

The agent loop currently owns _both_ "is it structurally safe to drain?" (a real concern only it can answer) and "is it strategically wise to drain?" (a producer/consumer cadence question that has nothing to do with the loop). This spec separates the second concern out.

This branch ships the primitives. Migrating signal delivery onto them is future work.

---

## 2. Solution summary (as shipped)

Introduce **opt-in, per-subscription batching as a first-class capability of the `PubSub` abstraction**.

```ts
await pubsub.subscribe(topic, cb, {
  group: 'active-run',
  batch: { maxSize: 8, maxWaitMs: 1500, minIntervalMs: 500, isImmediate, coalesce },
});
```

Subscribers that omit `batch` see no behavior change. Subscribers that pass `batch` receive their callback invocations grouped according to the policy. The callback signature is unchanged — a batch of N events is delivered as N consecutive callback invocations in publish order.

Concretely, this branch adds:

- `SubscribeBatchOptions` and `SubscribeOptions.batch` in `packages/core/src/events/types.ts`.
- `PubSub.supportsNativeBatching` capability flag (default `false`).
- An in-process implementation in `packages/core/src/events/event-emitter/` — `BatchPolicy` (decision engine), `AckHandleBuffer` (queue + dispatch), and `EventEmitterPubSub` wiring them together. These three live under `event-emitter/` because `EventEmitterPubSub` is currently their only consumer; they are not re-exported as a public abstraction.
- `CachingPubSub` is transparent to batching: it forwards `options.batch` to the inner PubSub and mirrors `supportsNativeBatching`.

There is no `BatchingPubSub` wrapper class. There is no cache-backed batching layer. There is no signal-saving subscriber, no topic scheme, no agent-loop wiring change. Those are explicitly deferred (§7).

---

## 3. PubSub core API changes

### 3.1 `Event` and `EventCallback` are unchanged

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

No payload-shape changes.

### 3.2 `SubscribeBatchOptions`

In `packages/core/src/events/types.ts`:

```ts
export interface SubscribeBatchOptions {
  maxSize?: number;
  maxWaitMs?: number;
  minIntervalMs?: number;
  isImmediate?: (event: Event) => boolean;
  coalesce?: (events: Event[]) => Event[];
  maxBufferSize?: number;
  overflow?: 'drop-oldest' | 'drop-newest' | 'coalesce-or-drop-oldest';
}
```

Field semantics (full JSDoc on the type itself):

- `maxSize` — flush when the buffer holds this many events.
- `maxWaitMs` — flush when the oldest event has been waiting this long. Timer starts on empty→non-empty.
- `minIntervalMs` — minimum wall time between consecutive batch deliveries. Even if `maxSize` / `maxWaitMs` would fire, the buffer holds until this interval elapses since `lastDeliveredAt`.
- `isImmediate(event)` — per-event escape hatch. Flush on publish, subject to `minIntervalMs`.
- `coalesce(events)` — applied to the batch before delivery. **Reference-identity contract:** must return a subset of its input events by reference. Returning fresh `Event` objects (even with matching `id`) discards the whole batch as a contract violation and acks every original as dropped. Rationale: ack/nack handles live on the original `Event` reference; manufactured events have no transport handle. If you need merged payloads, build them in the subscriber callback after delivery. Ordering must be preserved.
- `maxBufferSize` — overflow trigger; defaults to 256. Immediate events are never dropped on overflow.
- `overflow` — `'coalesce-or-drop-oldest'` (default), `'drop-oldest'`, `'drop-newest'`.

`SubscribeOptions.batch?: SubscribeBatchOptions` is added; `group` is unchanged.

### 3.3 Per-event invocation, not per-batch

A batch of N events delivered together produces N consecutive `cb(event, ack, nack)` invocations, in order, on the same event-loop tick. Rationale:

- Every existing subscriber works unchanged.
- The signal-saving callback (when that lands) wants per-signal handling anyway.
- `ack`/`nack` per event preserves redelivery semantics on adapters that support them.

The observable batching property — _temporal grouping_ — is captured by callback timing, not signature.

### 3.4 `PubSub.supportsNativeBatching`

```ts
get supportsNativeBatching(): boolean {
  return false;
}
```

Capability advertisement. Defaults to `false`. Implementations override and return `true` once they integrate `options.batch` (either via `AckHandleBuffer` or via their broker's own retention). `CachingPubSub` forwards its inner's value (§4.2).

---

## 4. Adapter behavior

### 4.1 `EventEmitterPubSub` (shipped — native, in-process)

The only adapter that natively honors `options.batch` on this branch.

This adapter is strictly in-process — producers, subscribers, and the batch buffer all live in the same Node process. The only failure mode for an in-memory buffer is "the process crashes", which kills every other piece of state too. There is no durability gap to close.

Implementation, in `packages/core/src/events/event-emitter/`:

- `EventEmitterPubSub.supportsNativeBatching` returns `true`.
- On `subscribe(topic, cb, { batch })`: construct an `AckHandleBuffer` keyed by `cb` (per-topic map). The emitter listener pushes events into the buffer; the buffer's `BatchPolicy` decides when to flush.
- Ack/nack are no-ops at this layer (a synchronous emitter has no redelivery semantics). The buffer still surfaces them as no-op callbacks so the subscriber API is uniform.
- `flush()` drains every per-subscriber buffer, then waits for any `nack`-scheduled redeliveries, looping until both are empty.
- `close()` disposes every buffer.

Internals (`BatchPolicy`, `AckHandleBuffer`) are intentionally not re-exported through `packages/core/src/events/index.ts` — they describe how this adapter implements its policy, not a stable cross-adapter abstraction. If a future adapter wants to reuse them, that's the moment to evaluate whether they belong at a higher level.

### 4.2 `CachingPubSub` (shipped — transparent passthrough)

`CachingPubSub` is transparent to batching:

- `subscribe(topic, cb, options)` forwards `options` (including `options.batch`) to the inner PubSub.
- `supportsNativeBatching` returns `this.inner.supportsNativeBatching`.

Consequence to be aware of: wrapping a _non-native_ inner adapter (the common case — that's why `CachingPubSub` exists) with `{ batch: {...} }` results in the batch options being passed to an adapter that ignores them. Delivery will be unbatched. This is documented on the `CachingPubSub` class JSDoc; there is no runtime warn (it would fire on every subscribe).

An earlier draft of this spec had `CachingPubSub` implement cache-backed batching directly, using cache cursors instead of an in-memory buffer. That code was prototyped and removed because the policy state (`BatchPolicy.size`, `firstQueuedAt`, `lastDeliveredAt`, the `setTimeout` handle) lives in-process. Two `CachingPubSub` replicas sharing a `subscriberId` would each run their own `BatchPolicy`, race on `flushOnce` calls, and corrupt the cursor. A correct distributed implementation needs policy state in the cache, a shared scheduler, and a lease/coordinator — which is a substantial design, not a primitive. Deferred.

### 4.3 Future adapters (not in this branch)

- `RedisStreamsPubSub` — would honor `options.batch` by tuning `XREADGROUP COUNT`/`BLOCK`, holding ack handles in `AckHandleBuffer`, ack'ing per delivered event. Coalesced-out messages get XACKed without delivery. Crash recovery via `XAUTOCLAIM` (existing). Would set `supportsNativeBatching = true`.
- `GoogleCloudPubSub` — would honor `options.batch` via subscriber-side `flowControl.maxOutstandingMessages`, delayed `Message.ack()`, and the existing `MaxExtension` window. Cap `maxWaitMs ≤ MaxExtension × 0.8`; warn on exceed. Would set `supportsNativeBatching = true`.
- `UnixSocketPubSub` and other non-native transports — would need either (a) a native broker, (b) the deferred distributed-batching design on top of `CachingPubSub`, or (c) accept unbatched delivery.

None of this is implemented on this branch.

---

## 5. Edge cases

### 5.1 Ordering

`EventEmitterPubSub` synchronous emit preserves publish order per topic. `coalesce` must preserve ordering for events it keeps (enforced by reference-identity contract — see §3.2). `nack` redelivery uses `setTimeout(0)` and can interleave with concurrent publishes; treat `nack` ordering as best-effort within a topic.

### 5.2 Buffer overflow

`maxBufferSize` defaults to 256. With typical signal size ~1KB, this caps in-memory cost at ~256KB per active subscription. `isImmediate` events are never dropped on overflow. If `coalesce` is provided, it runs first; if still over budget, the configured `overflow` strategy applies.

### 5.3 Test determinism

`BatchPolicy` accepts `BatchPolicyDeps` injection (`now`, `setTimeout`, `clearTimeout`) so tests use a fake clock deterministically. `AckHandleBuffer` propagates the same deps. The `BatchPolicyTimerHandle` is a branded type so test fakes are type-checked at the boundary.

### 5.4 `ack`/`nack` interaction with batching

`AckHandleBuffer` stores `(eventRef, ack, nack)` triples and invokes `cb(event, ack, nack)` at flush time, so the original transport ack handles reach the user callback. For `EventEmitterPubSub`, ack/nack are module-level no-ops.

Partial-batch failure: per-event semantics. If a `cb` throws or rejects for one event, the error is logged via the buffer's `onError` hook; subsequent events in the same flush still run. `policy.size` decrements once per event regardless of cb outcome — the invariant `delivered + dropped === snapshot.length` holds.

---

## 6. Non-goals

- Changing the `signal` storage role or XML wrapping.
- Removing the structural boundary check from `llm-execution-step.ts`. The chunk-type whitelist stays — it's about _safety_, not _cadence_.
- A `subscribeBatch` API delivering `Event[]`. Per-event callback shape preserved.
- A `BatchingPubSub` wrapper class. Batching state lives in the adapter that owns the retention.
- Cache-backed / distributed batching. Deferred (§4.2).
- Signal-stack migration onto pubsub. Deferred (§7).

---

## 7. What did not ship (deferred)

Listed for honest tracking; each is its own follow-up.

- **Signal delivery on pubsub.** Both signal stacks (regular agent via `AgentThreadStreamRuntime`, durable agent via run-registry) still use their existing in-process queues. Migrating them is the whole point of having `options.batch` at all, but it's the larger change.
- **Per-Agent `signalBatching` config.** No public surface yet. Once the signal-saving subscriber exists, this is the next step.
- **Native batching in `RedisStreamsPubSub` and `GoogleCloudPubSub`.** Sketched in §4.3; not implemented.
- **Distributed batching in `CachingPubSub`.** Removed from this branch (§4.2). Requires policy state in cache + lease/coordinator.
- **Observability.** No batching-specific debug log emitted yet. Errors surface via the adapter's `logger`; cadence is silent.

---

## 8. Open questions (still open)

1. **Default `maxBufferSize`?** 256 is a guess. Needs to be informed by real burst patterns once a producer (e.g. MastraCode file watcher) actually exercises this.
2. **Per-type vs. single-policy coalesce.** Should the framework eventually support per-event-type sub-policies, or stay with "write a `coalesce` function"? Decide before any user-facing API freezes.
3. **Where does `signalBatching` configuration live?** Per-Agent vs. per-Mastra with override. Proposed: both, Agent overrides. Confirm when the signal-stack migration starts.
4. **Error message when batching is requested but unsupported.** Currently silent passthrough through `CachingPubSub` (§4.2). Worth a runtime warn if this becomes a real footgun.

---

## 9. Rollout

PR1 shipped (this branch). It is purely additive — no consumer code paths change unless `options.batch` is explicitly passed. PR2 (signal-stack migration) and PR3 (native batching in Redis/GCP adapters) are not yet planned and will have their own specs when they are.

---

## 10. Worked example (in-process)

**Pubsub:** `EventEmitterPubSub` (default; in-process).

**Subscription:**

```ts
await pubsub.subscribe('agent-signals:R:T', cb, {
  batch: {
    maxSize: 8,
    maxWaitMs: 1500,
    minIntervalMs: 750,
    isImmediate: e => e.type === 'user-message',
    coalesce: events => dedupeFileChangedByPath(events),
  },
});
```

**Timeline (ms):**

| t    | Event                            | Buffer | Notes                                                                                                  |
| ---- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| 0    | subscribe with above options     | —      | `AckHandleBuffer` created                                                                              |
| 100  | publish `file-changed: src/a.ts` | [1]    | firstQueuedAt=100; deadline at t=1600                                                                  |
| 250  | publish `file-changed: src/b.ts` | [2]    |                                                                                                        |
| 400  | publish `file-changed: src/a.ts` | [3]    | will be coalesced with the first                                                                       |
| 550  | publish `file-changed: src/c.ts` | [4]    |                                                                                                        |
| 700  | publish `user-message: …`        | [5]    | `isImmediate` matches → flush now                                                                      |
| 700  | **batch delivered**              | []     | coalesce returns 4 events (one per path + user-message); cb invoked 4× in order; `lastDeliveredAt=700` |
| 900  | publish `file-changed: src/d.ts` | [1]    | firstQueuedAt=900; `minIntervalMs` floor t=1450 < deadline t=2400 → effective t=2400                   |
| 1100 | publish `file-changed: src/d.ts` | [2]    | will coalesce                                                                                          |
| 2400 | maxWaitMs elapsed                | —      | **batch delivered**: 1 event after coalesce; `lastDeliveredAt=2400`                                    |

Net: subscriber invoked five times instead of seven separate dispatches, with the `user-message` preempting correctly and duplicate path events coalesced. No cache, no extra processes — just a buffer inside the emitter.
