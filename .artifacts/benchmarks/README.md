# Redis per-chunk stream delivery benchmark

Standalone **wrapper microbenchmark**, not an Agent implementation or PR3 verdict. No runtime files, dependencies, or package manifests are changed. Requires an already-installed Mastra workspace, Node with the existing `tsx` loader, built workspace dependencies needed by source imports, and an explicitly supplied **isolated disposable Redis** instance. Imports the actual checkout's `CachingPubSub`, `RedisServerCache`, and `RedisStreamsPubSub`; it does not substitute raw Redis commands for their publish/replay paths.

## Run

From the repository root:

```sh
REDIS_URL=redis://127.0.0.1:6381 \
  node --import tsx .artifacts/benchmarks/stream-delivery.mjs > /tmp/stream-delivery.jsonl
```

Use an existing local Redis or provision your own isolated Redis. Do not aim this at production. URLs, credentials, raw errors, and stacks are deliberately not printed. Only random invocation-prefixed keys are deleted; no `FLUSHDB`. Cache/stream keys have a 120-second TTL as a fallback after interruption. Subscriber leases use the adapter's own lifecycle. Redis failure can prevent cleanup.

Quick verification (all four profiles, both designs):

```sh
REDIS_URL=redis://127.0.0.1:6381 CHUNKS=30 WARMUPS=0 REPEATS=1 \
  node --import tsx .artifacts/benchmarks/stream-delivery.mjs
```

RTT/workload matrix, using **real endpoints** (no fake Redis sleeps):

```sh
REDIS_URL="$ISOLATED_REDIS_URL" CHUNKS=2000 PAYLOAD_BYTES=1024 INTERVAL_MS=10 \
  REPEATS=5 WARMUPS=1 PROFILES=normal,slow SLOW_MS=20 \
  node --import tsx .artifacts/benchmarks/stream-delivery.mjs > /tmp/paced-remote.jsonl
```

Repeat on colocated and genuinely remote Redis and at representative pacing, payload sizes, and subscriber rates. The environment row records 30 measured PING RTTs (not the full multi-command wrapper RTT). No server clock synchronization is needed: production and sink timestamps share this Node process's monotonic clock.

| Environment variable | Default | Meaning |
| --- | ---: | --- |
| `REDIS_URL` | required | Explicit isolated Redis URL; never emitted |
| `CHUNKS` | 500 | Frames per trial |
| `PAYLOAD_BYTES` | 512 | ASCII text bytes per frame, excluding envelope/protocol overhead |
| `INTERVAL_MS` | 0 | Awaited source pacing **after each producer iteration**; publish-first also waits for publish, so effective rate differs |
| `REPEATS` / `WARMUPS` | 3 / 1 | Measured/warmup pairs per profile; warmups emitted but labeled |
| `PROFILES` | `normal,slow,cache-failure,transport-failure` | Comma-separated selection |
| `SLOW_MS` | 5 | Explicit caller sink processing time per frame in `slow` only |
| `FAIL_EVERY` | 10 | Every Nth append or transport publish fails in its corresponding profile |
| `TIMEOUT_MS` | 60000 | Per-trial deadline; increase for large slow workloads |

## Designs and identical caller sink

Each trial starts fresh namespaces/cache clients and independent RedisStreams writer/reader instances. A real replay/live observer is attached **before** production in both designs. Both caller paths use the same serialized, unbounded in-memory sink queue, payload, monotonic timestamp, and configured slow-consumer workload. The observer is fast; only the caller is slow in `slow`.

1. **`direct-queued-copy`**: hand the produced frame directly to the caller sink, then enqueue a serial `CachingPubSub.publish()` for replay/live observers. Producer does **not** wait for Redis; explicitly wait for the copy queue at completion. No data coalescing, dropping, concurrency, or retries are added. Queue depth and drain time reveal the deferred cost.
2. **`publish-first`**: await `CachingPubSub.publish()` per produced frame. Caller receives it through the actual independent RedisStreams reader plus `CachingPubSub.subscribeWithReplay()` before entering the **same sink**. Caller and diagnostic observer share that one reader callback; no second caller Redis reader is added.

Both variants ack transport receipt after enqueueing into sinks, not after slow processing. This avoids conflating Redis pending-entry retries with the explicit sink workload. Both queues are deliberately unbounded: **this does not prove bounded-memory backpressure or a shippable architecture**. Slow-consumer backlog and throughput must be considered alongside latency.

After persistence completes, allow live delivery to settle (500 ms quiet window, bounded by deadline), then inspect a fresh transport's `subscribeWithReplay()` result. Settlement/subscription/cleanup overhead is excluded from delivery throughput clocks. The replay reader is closed after attach-time replay; this is a snapshot of the wrapper's retained replay, not a long-lived reconnect or disconnect/reconnect Agent test.

## Metrics (JSONL, milliseconds unless named otherwise)

- `primary` and `observer`: producer timestamp → completed caller/sink processing `latencyMs` p50/p95/max, `firstFrameMs` from first generation, last completion time, chunks/s, payload bytes/s, count, unique count, duplicates, missing sequence IDs, ordering, payload bytes.
- `publishMs`: duration of each actual wrapper publish attempt, including cache append, live transport and injected failure handling. Not raw Redis RTT.
- `queueWaitMs`: enqueue → start of publish. Approximately zero in publish-first; captures serial-copy backlog in direct mode.
- `enqueueToPublishSettledMs`: enqueue → wrapper publish settlement (success **or rejection**, not guaranteed durability).
- `queueDrainAfterProducerMs`: elapsed time waiting for copies **after production stopped**; end-to-end persistence cost remains in `publishSettledMs`.
- `producerMs`, `peakPersistenceQueue`, `peakCallerQueue`: distinguish fast initial delivery from deferred work and buffering.
- `replay`: exact sequence counts/order/bytes read through the real replay wrapper and replay read time. Cache loss can make replay incomplete even when live delivery succeeds.
- `cacheAttempts`, `cacheFaults`, `cacheWarnings`, `transportAttempts`, `transportFaults`, `publishErrors`: explicit failed-attempt accounting.

P50/p95 are nearest-rank per-trial frame percentiles. Do **not** average trial p95s into an overall p95; compare repeated trial distributions (or extend the harness to emit raw samples). Small trials are verification, not stable latency estimates. Warmups are marked `warmup: true`; mode order alternates each pair. Fresh Redis clients make first-frame time include cold publisher connect/handshake; subscriber attachment is excluded. No OS/network byte accounting or heap profiling is claimed. Payload bytes are not serialized envelope bytes and not Redis wire bytes.

## Fault profiles and verification

- `cache-failure`: throw immediately before every Nth call to the **real cache's** `listPushIndexed`; other calls execute real Redis Lua append/index/TTL operations. CachingPubSub's actual catch-and-live-publish behavior remains intact. The fault is a deterministic injected operation failure, **not** a Redis outage or RTT simulation.
- `transport-failure`: throw immediately before every Nth call to the **real writer's** publish; cache append still runs. Later indexed live frames may backfill cached gaps; a failed final live frame may be absent until replay. No catch-up success is assumed.
- `normal`/`slow`: assert exact ordered sequence 0..N-1, no duplicates or omissions, exact payload-byte totals for caller/live observer/fresh replay, and zero publish errors.
- Fault profiles assert requested injection counts, exact cache-warning/transport-rejection accounting, and direct caller completeness; report all other losses/duplicates explicitly rather than treating success as correctness proof. A synthetic failure has zero network duration and biases aggregate failure-profile timings downward: use normal/slow for latency decisions.

Exit 0 means configured trials and invariants completed, **not** that the architecture is safe under real process death, partial writes, partitions, OOM, or Redis failover. Nonzero exit is intentionally redacted to avoid secrets. A timed-out operation can still be in flight until CLI exit; use disposable Redis and TTLs, not this script as an operational health check.

## Interpretation and limits

This measures a single Node process, one producer and one independent live Redis reader per trial. It excludes full Agent execution, model/network streaming, HTTP/SSE parsing, cross-process scheduling, cancellation, durable execution recovery, crash consistency, concurrent tenants, bounded queues, cluster/TLS behavior, and application work beyond the explicit sink delay. Direct delivery still incurs queue allocation/scheduling, while publish-first necessarily crosses the real cache/transport boundary. The script measures those tradeoffs without proposing or changing runtime source.

Decide PR3 only after representative measured Redis RTT, workload rate/bytes, acceptable first-frame/p95 latency, memory bounds, failure policy, and Tony's signoff. Local numbers alone do not justify replacing either delivery design.

## Local validation — November 5, 2026

Measured source HEAD: `43f77e77a0ed4a1b2032a9f955dbbcef08ae3c12`, Node `v22.23.3`, isolated local Docker Redis on loopback. The three imported wrapper source files are byte-identical to `3a01ed16f42d283008c734be2c4c441355a8fdc4` and `57a1fb155e094f9d376e89a3110647dce066974f` (verified with Git diffs). This pins wrapper implementation, not the entire dependency graph or Agent runtime.

Validation passed: eight 30-frame quick trials, then **32/32 500-frame trials** (one warmup + three measured repeats, four profiles, two modes). Payload 512 bytes; source unpaced; slow sink 5 ms/frame; every tenth operation injected in fault profiles. Normal/slow caller, observer and replay each contained exactly 500 ordered frames and 256,000 payload bytes. PING RTT p50 **0.155 ms**, p95 **0.532 ms** (30 samples).

Ranges below are the minimum/maximum **per-trial** metrics across three measured repeats; not pooled percentiles.

| Profile / design | Caller p50 ms | Caller p95 ms | First frame ms | Copy drain after producer ms |
| --- | ---: | ---: | ---: | ---: |
| Normal / direct queued | 0.342–0.405 | 0.350–0.425 | 0.208–0.312 | 265.259–283.416 |
| Normal / publish first | 0.423–0.527 | 0.747–0.922 | 0.980–1.581 | ~0.001 |
| Slow / direct queued | 1287.352–1291.613 | 2460.574–2463.131 | 4.599–5.750 | 283.010–312.791 |
| Slow / publish first | 1125.376–1168.787 | 2169.190–2230.787 | 6.406–7.657 | ~0.001 |

The slow-source timestamps differ because publish-first naturally paces generation by awaiting Redis. Its lower slow-profile per-frame latency is **not evidence of higher throughput**; these are separate workload/backlog trajectories, not a fixed external arrival schedule. Use emitted completion/throughput/backlog metrics together. Direct mode's low normal caller latency defers hundreds of milliseconds of copy work instead of eliminating it.

Observed failures, three measured repeats each:

- **Cache-only**: exactly 50 injected append failures, zero rejected publishes; both designs' live callers and observers received all 500 frames. Fresh replay received **450–452**, so neither complete replay nor universal publication failure is claimed. The extra uncached frames can arrive through the retained transport during attach; attach timing is not a persistence guarantee.
- **Transport-only**: exactly 50 rejected publishes; later indexed events repaired earlier live gaps. Both live observers received **499**, missing the final failed frame; direct caller received **500**, publish-first caller **499**. Fresh replay received **500** in both designs. A transient rejected publish is therefore **not automatically fatal**; nor is an incomplete live stream evidence that the owning execution stopped.

These numbers are a local harness check, not hosted/remote RTT evidence, whole-Agent measurements, or a PR3 recommendation. Raw JSONL was retained outside the two committed artifacts in the local scratch directory; rerun commands above to reproduce structured results.
