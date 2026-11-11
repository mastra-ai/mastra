# COR-1527 — Establish the long-outage stream publish failure contract

## Goal

Settle, with reproducible evidence, what a stream publish failure during a long Redis
outage actually means — for plain agents and for durable/evented runs — and produce an
approval-gated contract proposal.

Two questions must be answered from measurement, not from reading:

1. **Which component raises the plain-run publish timeout?** Shipyard's 12 retained
   300 s-outage failures all said
   `redis-streams: publish did not reach Redis within 120000ms`, while the hub runs
   (same transport family, 60–300 s outages) logged no publish timeouts at all. The
   only known difference is the server cache (`RedisServerCache` vs `InMemoryServerCache`).
2. **What should a publish failure mean?** Today a timeout does not mean
   "not delivered" — the underlying `XADD` is not cancelled and can land after
   recovery — and on the durable path the failure is reported through the same stalled
   bus, so the caller learns about it only after recovery and receives two error frames.

Deliverables: raw evidence + a timeline-report under `.artifacts/cor-1527/`, and a
written contract proposal. **No runtime/behaviour changes, no PR.** Runtime changes
need Nik's explicit approval after reading the proposal.

## Scope

In scope

- One isolated paired experiment: identical runs that differ **only** in the server
  cache implementation (`InMemoryServerCache` vs `RedisServerCache`).
- Instrumentation at three boundaries: cache append, transport `XADD`, observer delivery.
- Ground truth from Redis itself (`MONITOR`) so "did the write reach Redis, and when"
  is not inferred from client-side bookkeeping.
- A durable run under the same outage, to capture the caller-visible failure sequence.
- A contract proposal: definitions, options, and doc changes — as text only.

Out of scope

- Any change to `packages/core`, `pubsub/redis-streams`, `stores/redis`, docs, or tests
  that ship. Nothing is pushed except this plan and evidence artifacts.
- Queue growth / backpressure (COR-1526) and re-qualifying the COR-1519 harness output.
- Changing or restarting any shared Factory Redis, or any service other than the
  dedicated disposable container this experiment creates.

## Verified current state (against `mastra` @ `a3c08844`, `origin/main` `3cb6caba`)

- **The 120 s is a transport budget, not a cache or agent timeout.**
  `pubsub/redis-streams/src/index.ts:346` defines `PublishRetryBudgetExhaustedError`;
  `:338` `publishRetryBudgetMs` defaults to `120000` (`PUBLISH_RETRY_BUDGET_MS`).
  `#publishRemote()` (`:619-661`) sets `deadline = Date.now() + budgetMs` and races each
  `#xaddEvent()` against a timer (`:645-652`) that rejects with
  `PublishRetryBudgetExhaustedError`. The `XADD` attempt itself is never cancelled.
  Documented at `docs/src/content/en/reference/pubsub/redis-streams.mdx:165-168`.
  Covered by `pubsub/redis-streams/src/publish-transient-retry.test.ts:65-81`.
- **The budget starts late.** `CachingPubSub.publish()` (`packages/core/src/events/caching-pubsub.ts:244-297`)
  does `await this.cache.listPushIndexed(...)` (`:271`) **before** `inner.publish(...)`.
  So the 120 s clock only starts once the cache append has resolved. The cache append
  has no budget of its own.
- **The two caches differ exactly there.** `RedisServerCache.listPushIndexed`
  (`stores/redis/src/cache.ts:239-275`) evaluates a Lua script (INCR + RPUSH + EXPIRE)
  over the Redis connection; on `CROSSSLOT` or a client without `eval` it degrades to
  two non-atomic round-trips (`composedPushIndexed`, `:277-281`). `InMemoryServerCache`
  resolves in-process. If Redis parks commands in its offline queue while unreachable,
  the cache append blocks with no deadline — the transport budget never starts, and no
  `PublishRetryBudgetExhaustedError` is ever raised. That is the standing hypothesis for
  the hub-vs-Shipyard discrepancy, and Phase 2 tests it directly.
- **The plain path swallows publish failures by design.** `createAgentStreamPublisher`
  (`packages/core/src/agent/streams/publisher.ts:17-23`) documents "Publishing never
  blocks or fails the run"; `enqueue` (`:140-150`) chains an unbounded promise chain and
  turns rejections into a `logger.warn`. So a 120 s timeout on a plain run cannot fail
  the run — the question is only what the run reports about those frames.
- **The durable path reports failure through the stalled bus.** `settleExecution`
  (`packages/core/src/agent/durable/durable-agent.ts:2690-2752`) calls `emitError()`,
  which awaits `emitErrorEvent(this.pubsub, ...)` (`:2585`); a failure there is caught
  and logged (`Failed to publish error event for run ...`), so the run's failure is
  invisible to the caller until Redis recovers and the frame finally lands.

Reusable test patterns for the harness: `packages/core/src/agent/streams/__tests__/publisher-snapshot.test.ts:17`
(a cache that holds every append until released) and
`__tests__/agent-streams.test.ts:242` ("a cache that lost its connection queues reads
until it reconnects").

## Phase 1 — Disposable Redis and harness shell

1. Start a dedicated container, never the shared Factory Redis:
   `docker run -d --rm --name cor1527-redis -p 6399:6379 redis:8` (pin the digest in the
   log). Confirm `redis-cli -p 6399 ping` → `PONG` and record `INFO server`
   (version/digest).
2. Create `.artifacts/cor-1527/` with `README.md` (how to re-run), `scripts/`, `runs/`.
3. Harness script: one Node process per run, built from the repo's workspace packages
   (`pnpm turbo build --filter="@mastra/core^..."` and the redis package as needed) —
   no edits to package sources.
   - `Mastra({ pubsub, cache })` where `pubsub` is a `RedisStreamsPubSub` pointed at
     `redis://127.0.0.1:6399` with default `publishRetryBudgetMs`, and `cache` is
     selected by flag: `--cache=memory|redis` (`new InMemoryServerCache()` /
     `new RedisServerCache({ client })`).
   - Fixed inputs: 16-character chunks at 20/s, a fixed prompt handled by a deterministic
     local model stub (no provider calls, so no account rate limits and no model drift),
     fixed `runId` prefix, fixed `keyPrefix` per run, 300 s outage.
   - Both arms use the same Redis container, same image, same chunk cadence, same
     outage length, same start offset. Only `--cache` differs.
4. Instrumentation (all additive, all in the harness):
   - **Cache boundary:** wrap the cache object with a proxy that logs entry/exit and
     outcome of `listPushIndexed`, `listLength`, `listFromTo`, `increment`, `listPush`.
   - **Transport boundary:** wrap the pubsub's `publish` to log call start/end/outcome
     and the frame's `index` when known.
   - **Redis ground truth:** a second client issues `MONITOR` for the whole run; the
     harness records arrival timestamps of `XADD`, `EVAL`/`EVALSHA`, `PEXPIRE`, `RPUSH`,
     `INCR` for the run's keys. This is what separates "never reached Redis" from
     "reached Redis after recovery".
   - **Delivery:** an observer subscribes to the run topic and records per-frame arrival
     (frame id/index, wall clock, payload length) plus the terminal frame.
   - **Clock markers:** run start, first chunk, outage start, outage end, every
     cache-append entry/exit, every publish resolution/rejection, every terminal status,
     and every caller-visible error.
5. Log format: one JSONL file per run in `runs/<run-id>/timeline.jsonl` plus the
   `MONITOR` capture, the harness console output, and a `meta.json`
   (git SHA, node/pnpm versions, redis digest, flags, chunk cadence, outage window).

Gate G1: harness runs green with Redis up (baseline, no outage) for both cache arms —
same frame count, no rejections, no delivery gaps. If the baseline differs between
arms, stop: the comparison is invalid.

## Phase 2 — The paired outage run (the core evidence)

6. Arm A — `--cache=memory`: start the run, wait ~5 s, `docker pause cor1527-redis` for
   300 s, then `docker unpause`. Keep publishing throughout. Wait for terminal status.
7. `FLUSHALL` on the disposable instance, restart the harness process, run Arm B —
   `--cache=redis` — with the identical timeline.
8. Optional third/fourth arm only if the first pair is ambiguous: same pair with
   `docker stop` (socket closed → transient connection errors) instead of pause, to
   separate "command parked" from "connection rejected". Same 300 s window.
9. Record per arm: when the first publish rejection occurred (relative to outage start),
   how many publishes were in flight, how many cache appends were outstanding, whether
   `XADD` reached Redis during the outage (it should not), whether it landed after
   unpause and when, and which frames the observer eventually received.

Gate G2 (hypothesis test):

- Arm A must reproduce the Shipyard signature: at least one publish rejecting with
  `PublishRetryBudgetExhaustedError` roughly 120 s after the outage starts, i.e. before
  recovery — which also confirms the budget can only start once the in-memory append has
  resolved.
- Arm B must show the opposite ordering: cache appends outstanding past 120 s, and
  therefore no `PublishRetryBudgetExhaustedError` before recovery. Record what does
  happen (indefinite hang until unpause, or a different error) — the observed behaviour
  is the finding even if it contradicts the hypothesis.

If Arm A does **not** reproduce the timeout, the hypothesis is wrong: stop and report the
raw timelines instead of pushing further configurations.

## Phase 3 — Durable arm and failure accounting

10. Repeat once with a durable/evented agent under the same 300 s outage, both caches if
    time allows, otherwise `RedisServerCache` only (that is the deployed shape). Record:
    when the run itself fails, when the caller/observer learns of the failure, what
    frames the caller receives (count and type of error frames, with timestamps), and
    whether any output frame is permanently lost.
11. Build the per-frame truth table for every arm:
    `produced → cache-append (ok/failed/hung, at T) → XADD reached Redis (never / at T)
→ delivered to observer (never / at T) → publish settled (at T, resolved/rejected)`.
    This table is the evidence for the "timeout = outcome unknown" claim.

Gate G3: every rejected publish is classified into exactly one of
_delivered_, _not delivered (durably failed)_, _unknown (may still land)_ — with a
timestamp proving the classification.

## Phase 4 — Contract proposal (design only)

12. Write `.artifacts/cor-1527/REPORT.md`: hypothesis, method, per-arm timelines,
    truth tables, and answers to the two questions in Goal.
13. Propose the contract, as options with trade-offs — not as code:
    - **Plain:** what `PublishRetryBudgetExhaustedError` must mean to a caller
      (explicitly _unknown_, since the `XADD` is uncancelled and may land), what a plain
      run may claim about frames it failed to publish, and whether the _whole_ publish
      path (cache append + transport) should share one deadline instead of the transport
      alone owning it.
    - **Durable:** how the run-failed error reaches the caller without depending on the
      stalled transport, and how to drop the duplicate error frame.
    - **Docs:** which sentences in `docs/src/content/en/reference/agents/durable-agent.mdx`
      (`:346-350`) and `reference/pubsub/redis-streams.mdx` (`:165-168`) become wrong
      once the contract is decided.
14. Post a concise summary as a comment on COR-1527 and report to the orchestrator
    session. Stop there; do not implement.

## Verification / gates

- **G1** baseline parity between arms (Phase 1).
- **G2** the paired contrast (Phase 2) — Arm A timeout before recovery, Arm B no timeout
  before recovery, each backed by `MONITOR` timestamps.
- **G3** per-frame classification completeness (Phase 3).
- **G4** evidence is reproducible: `README.md` lets a second person rerun both arms and
  get the same ordering.
- **G5** no shipped file changed: `git status` clean except `.artifacts/`; no push beyond
  this plan branch; no PR.

## Risks and mitigations

- **Touching shared infrastructure** — only the named disposable container on port 6399;
  `docker ps` recorded before/after; any pre-existing Redis is never addressed.
- **Harness invalid because arms differ elsewhere** — one flag, one process shape, one
  Redis instance, `FLUSHALL` between arms, `meta.json` diffed before analysis (G1).
- **Hypothesis is wrong** — record and report; a negative result answers "which
  component raised the timeout" just as well, and Phase 4 becomes "explain the observed
  ordering".
- **Account/provider rate limits** — the harness uses a local model stub, so no provider
  calls. If any rate limit still appears, stop and report blocked; never retry-loop or
  switch providers to bypass it.
- **Long runs (4 × ~5.5 min plus build)** — build once up front, run arms sequentially,
  keep the container warm; total wall clock stays under ~15 min of actual runtime.
- **Docker pause quirks** (paused container keeps sockets open, so commands hang rather
  than error) — that is the interesting case; the optional `stop` arm covers the other.

## Assumptions

- The 12 retained Shipyard failures (`redis-streams: publish did not reach Redis within
120000ms`) came from `PublishRetryBudgetExhaustedError` — already confirmed by message
  match at `pubsub/redis-streams/src/index.ts:347`.
- Shipyard ran `RedisServerCache` with Redis 8; the COR-1519 harness ran
  `InMemoryServerCache` with Redis 7.4.12. That cache difference is the only variable
  this plan holds fixed and then varies deliberately.
- A deterministic local model stub is an acceptable stand-in for a real model here: the
  experiment is about the publish path, not about model output.

## Open questions

- Is the deployed Shipyard pubsub wrapped in `CachingPubSub` at all, or a bare
  `RedisStreamsPubSub`? If bare, the cache-append hypothesis cannot explain the hub, and
  Phase 2 must add a cache-off arm (`serverCache: undefined`) as the third condition.
- Does the duplicate error frame in the durable report come from the failed step's own
  error event plus `settleExecution`'s `reportError`, or from two `settleExecution`
  passes? Phase 3 answers this from timestamps; no assumption is baked into the contract
  proposal.
- Should the contract apply to `observe()` offsets as well (a frame that lands after
  recovery but was already reported as failed)? Flagged for the proposal, not decided
  here.
