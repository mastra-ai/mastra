# COR-1527 — What a stream publish failure means during a long Redis outage

Evidence report. **Evidence and options only — no runtime/contract change is implemented in this branch.**
Committed evidence lives under `.artifacts/cor-1527/`: the harness/analyzer scripts and, per run, `meta.json`,
`summary.json`, `truth-table.csv` and `console.log`. The raw `timeline.jsonl` and `monitor.log` (~72 MB) are
deliberately **not** committed and remain on the build sandbox — see §8 and `README.md`.

## 1. Environment

|                |                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo / head    | `mastra-ai/mastra` @ `a3c08844458bd5c1fc2148d3fb92190faa511aab` (dist built from this head)                                                             |
| Node           | v22.23.3                                                                                                                                                |
| Redis          | `redis:8`, server 8.10.3, image `sha256:1f88291b…dd53`, disposable container `cor1527-redis` on host `:6399`                                            |
| Redis client   | transport `RedisStreamsPubSub` uses **node-redis** (`redis` 5.12.1, `createClient`); the `RedisServerCache` client uses **ioredis** (documented wiring) |
| Cache arms     | `InMemoryServerCache` ("memory") vs `RedisServerCache` ("redis") — the only difference between paired arms                                              |
| Outage         | `docker pause` for 300 s (TCP socket stays open; commands are parked, not rejected)                                                                     |
| Publish budget | default `publishRetryBudgetMs = 120000`                                                                                                                 |

The harness (`scripts/harness.mjs`) runs a real `Mastra` with a `RedisStreamsPubSub`, streams deterministic 16-char
chunks every 50 ms, and records three independent boundaries: every cache call (`listPushIndexed` + friends),
every `RedisStreamsPubSub.publish` (with `budgetExhausted`), and every observer delivery. `redis-cli MONITOR` inside
the container records when EVAL/XADD actually executed server-side. No package source was modified.

## 2. Verdict

1. **The 120 s timeout is raised only by the transport**, in `RedisStreamsPubSub.#publishRemote()` (`pubsub/redis-streams/src/index.ts:619-661`) — a `Promise.race` between `#xaddEvent()` and a budget timer, rejecting with `PublishRetryBudgetExhaustedError`. Confirmed by `MONITOR` + client timing: no other layer throws it.
2. **The timeout means "outcome unknown", not "lost".** In every arm where it fired, the frame's XADD still reached Redis from node-redis's offline queue after recovery and was delivered to the observer. Callers that treat the rejection as data loss are wrong.
3. **With `RedisServerCache` the budget never arms.** `CachingPubSub.publish()` awaits `cache.listPushIndexed()` _before_ calling the transport (`packages/core/src/events/caching-pubsub.ts:244-297`). The cache append has **no budget of its own**, so during the outage it simply blocks; `#publishRemote` (and its 120 s timer) is never entered. Result: **0 rejections**, and the run survives by hanging.
4. **The retry budget is what breaks the durable run.** With `InMemoryServerCache` the cache append completes in-process, the budget arms, the publish rejects at +120 s, and the durable step fails — losing ~98 % of the run's output. The counter-intuitive consequence: the _deadline-less_ cache append "protects" the run; the _bounded_ publish is what kills it.
5. **Durable failures are silent to the caller until Redis recovers.** The error frame is published over the same stalled bus, so the caller learns nothing for ~60–180 s, and then receives **two** error events for one failure.

## 3. Paired plain-agent runs, 300 s outage (G2)

|                      | Arm A: `InMemoryServerCache`               | Arm B: `RedisServerCache`  |
| -------------------- | ------------------------------------------ | -------------------------- |
| Produced chunks      | 6 344                                      | 6 342                      |
| Frames published     | 6 350                                      | 6 348                      |
| Rejections           | **2** (`PublishRetryBudgetExhaustedError`) | **0**                      |
| First rejection      | +119.85 s (index 102)                      | —                          |
| Second rejection     | +239.85 s (index 103)                      | —                          |
| Longest cache append | 2 ms                                       | **300 031 ms** (index 102) |
| Longest publish      | 120 001 ms                                 | 15 ms                      |
| Frames delivered     | 6 350 (0 lost)                             | 6 348 (0 lost)             |
| Caller               | `finish`, 6 344 chunks                     | `finish`, 6 342 chunks     |
| Duplicates           | 0                                          | 0                          |

Arm A detail — the two "failed" frames were **not lost**. Both were pushed by the client after the socket drained
and were observed at +300.03 s, after recovery, then delivered:

| index | chunkSeq | xadd entered | rejected  | reached Redis | delivered | class                  |
| ----- | -------- | ------------ | --------- | ------------- | --------- | ---------------------- |
| 102   | 99       | −0.15 s      | +119.85 s | +300.03 s     | +300.03 s | rejected-but-delivered |
| 103   | 100      | +119.85 s    | +239.85 s | +300.03 s     | +300.03 s | rejected-but-delivered |

Because the plain publisher serialises its queue (one XADD in flight), only one frame can be timing out at a time, so a
300 s outage yields exactly two rejections.

Arm B detail — index 102 entered the cache append at +0.003 s and exited at +300.027 s (the whole outage); its XADD then
succeeded. No frame ever timed out because `#publishRemote` was never reached.

Client-side bookkeeping is wrong in both arms of the memory case: `CachingPubSub` retains `undeliveredIndices [102,103]`
and the plain publisher logs `failed to publish stream event`, even though both frames were delivered.

## 4. Paired durable-agent runs, 300 s outage (G3)

|                      | Arm A: `InMemoryServerCache`              | Arm B: `RedisServerCache`  |
| -------------------- | ----------------------------------------- | -------------------------- |
| Produced chunks      | 6 336                                     | 6 343                      |
| Frames published     | **105** (run aborted)                     | 6 350                      |
| Rejections           | **2**                                     | **0**                      |
| Longest cache append | 1 ms                                      | 300 024 ms                 |
| Longest publish      | 120 002 ms                                | 17 ms                      |
| Caller outcome       | **`error`**, 100 chunks, two error events | **`finish`**, 6 343 chunks |
| Frames lost          | **~6 236** (chunks 100–6335)              | 0                          |
| Duplicates           | 0                                         | 0                          |

Arm A timeline (seconds after outage start):

- +0.01 s — index 102 publish entered; the cache append is in-process, so the 120 s budget arms.
- +120.01 s — index 102 **rejected** (`PublishRetryBudgetExhaustedError`); `Error processing LLM stream`.
  The LLM step fails here; the model's remaining output is discarded.
- +120.02 s — index 103 publish entered (the settle/error path re-enters the same stalled bus).
- +240.03 s — index 103 **rejected**; `Workflow … durable-llm-execution: PublishRetryBudgetExhaustedError`, then
  `durable-agentic-loop … : undefined`. The run is now failed.
- **+300.04 s** — Redis recovers. Only now do the two rejected chunks (delivered-but-rejected) and the error frame
  (index 104) reach the observer, and only now does the **caller** observe the failure: two terminal `error` events
  with the same message, names `PublishRetryBudgetExhaustedError` and `Error`.

So: the step failed at +120 s, the run failed at +240 s, but the caller was told at +300 s — a **60–180 s silent
window** — and got **two error events for one failure**. Out of ~6 343 chunks the caller received 100; the rest never
reached the stream because the run aborted.

Arm B behaved like the plain Redis arm: the cache append for index 102 blocked for the whole outage, no budget armed,
no rejection, and the run completed normally with all 6 343 chunks and a `finish` — at the cost of blocking on Redis.

## 5. Per-frame truth table

`runs/<label>/truth-table.csv`, one row per published frame. The header has **17** columns:

`key, id, type, chunkSeq, index, class, cacheEnter, cacheExit, cacheOk, redisCache, xaddEnter, xaddExit, xaddOk, budgetExhausted, redisXadd, deliver, deliveries`

(`index` is column 5; `deliveries` counts duplicate deliveries of the same frame; `redisCache`/`redisXadd` are
`MONITOR` timestamps). Times are seconds relative to outage start.

`analyze.mjs` can assign seven frame classes: `resolved-delivered`, `resolved-not-delivered`,
`rejected-but-delivered`, `rejected-but-reached-redis`, `rejected-not-delivered`, `publish-never-settled`,
`never-reached-transport`. Only **`resolved-delivered`** and **`rejected-but-delivered`** occur in the committed
tables — baselines (no outage) are uniformly `resolved-delivered`; the remaining classes are defined for
completeness but did not occur here.

## 6. Contract options (design only — for approval, nothing implemented)

1. **Name the outcome.** A publish rejection during an outage must be documented as "delivery outcome unknown", not
   "lost". The frame may still be pushed from node-redis's offline queue after recovery (observed here). `CachingPubSub`
   should not mark such indices `undelivered`, and the plain publisher should not log them as failures.
2. **Bound the whole publish path, not just XADD.** Today the cache append (`listPushIndexed` / EVAL / INCR+RPUSH) has
   no deadline, while the XADD does. Decide which behaviour is intended:
   (a) give the cache append its own budget so both caches behave the same, or
   (b) keep the cache append unbounded and drop/relax the XADD budget so a publish does not fail a run mid-outage.
   Whichever is chosen, plain and durable should agree.
3. **Do not let a transient publish failure fail a durable run.** The failure should be retried/surfaced without
   aborting the step, or the run should degrade to "output truncated" rather than "run failed".
4. **Make the durable failure visible immediately.** `settleExecution` currently swallows error-frame publish failures
   and the frame only lands after recovery (`durable-agent.ts:2699+`). The caller should learn the run failed in-process.
5. **Deduplicate the error frame.** One failed run produced two caller-visible error events; one should be dropped.
6. **Docs.** `docs/.../reference/pubsub/redis-streams.mdx` documents the budget but not that exhaustion ≠ loss, and the
   durable-agent docs do not describe the caller-silence window.

## 7. Out of scope / not established

- Queue-cap behaviour (COR-1526) and COR-1519 qualification were not touched.
- Only `docker pause` was exercised; a `docker stop`-style hard disconnect (transient `ECONNRESET`) was not run.
- Only a 300 s outage (> budget) was run; no sub-budget control outage.
- Redis Cluster / `CROSSSLOT` fallback path was not exercised (single-node Redis).
- The exact provenance of the two caller error events (one error frame in the observer log vs two at the caller) is
  reported as observed; the mechanism was not traced further.
- Which cache implementation the originally failing deployment ran is **not recorded** here, so these runs establish
  the mechanism rather than reproduce that deployment exactly. A cache-off arm (a bare `RedisStreamsPubSub` without a
  `CachingPubSub` wrapper) was not run; the plan lists it as open.

## 8. Evidence index

| Path                                                                                                     | Contents                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs/G1-{baseline-memory,baseline-redis}/`                                                              | no-outage baselines (both arms clean)                                                                                                               |
| `runs/P2-plain-{memory,redis}/`                                                                          | plain-agent 300 s outage pair (§3)                                                                                                                  |
| `runs/P3-durable-{memory,redis}/`                                                                        | durable-agent 300 s outage pair (§4)                                                                                                                |
| `runs/P2-plain.driver.log`, `runs/P3-durable.driver.log`                                                 | run driver logs                                                                                                                                     |
| each run: `timeline.jsonl`, `monitor.log`, `truth-table.csv`, `summary.json`, `meta.json`, `console.log` | raw evidence — only `truth-table.csv`, `summary.json`, `meta.json`, `console.log` are committed; `timeline.jsonl`/`monitor.log` stay on the sandbox |
| `scripts/`                                                                                               | `harness.mjs`, `run-pair.sh`, `analyze.mjs`                                                                                                         |
