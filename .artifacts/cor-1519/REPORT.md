# COR-1519 qualification report (qualification only, no production changes)

## Provenance

| Item | Value |
| --- | --- |
| Source baseline | origin/main `2f6070d4f4feac4f814465061ccb3e6b36a07caf` (2026-11-10T04:50Z). It includes #29799 `4854e364`, #29803/COR-1517 `28ddc161`, and #29791/COR-1512 `8a10dfe6`. |
| Main drift at report time | origin/main is at `dab6546c`. The 2 new commits touch only factory code, not anything these tests use. |
| Checkpoint branch | `user/session-93bb4dd1-2bea-4730-9cfd-d59013e4f2d7`. It contains only test files and these artifacts. |
| Test commits | `603f1839` (cell 2 stall), `6ecf647f` (cell 3 supervisor), `e5be204e` (cell 4 Stop/reload), `0ac60188` (cell 2 backlog), `9cf729ba` (cell 3 resumed delegation) |
| Runtime | node v22.23.3, pnpm 11.21.0 |
| Built dists (from baseline, before any test edits) | core 04:48:22Z, libsql 04:48:24Z, client-js/hono/redis-streams 04:48:29Z |
| Inngest | inngest-cli 1.49.0-28cb5336b (from repo script `pnpm --filter @mastra/inngest setup:inngest-cli`), inngest SDK 4.26.2, real dev server |
| Redis | redis:7-alpine 7.4.12, local Docker on :6381. This is LOCAL, not remote. |
| Model edge | @copilotkit/aimock 1.47.0, used only at the HTTP model edge. Runtime, storage, transport and HTTP are real. |
| Browser | Playwright 1.64.1, Chrome Headless Shell 156.0.8078.4 (system deps via `sudo playwright install-deps chromium`, user cache only). Used for cell 4b. |

## Results by cell

### Cell 1: Inngest observe / replay / approval-resume on a real Inngest dev server. FAILS on main (D1)

Command:

```
cd workflows/inngest && AIMOCK_INNGEST_WORKERS=1 AIMOCK_SCENARIOS='{observe-frames,observe-approval-resume,observe-reattach,observe-replay-snapshot,observe-lifecycle,observe-state,observer-outcomes}' npx vitest run --project e2e:workflows/inngest:aimock --reporter=verbose
```

- Baseline `logs/inngest-observe-d1-baseline.log`: 13 failed, 7 passed, 1 expected fail, 6 skipped (27 tests).
  - 16 errors are the D1 `TypeError`.
  - 1 error is a follow-on assertion. In "keeps observing a suspended run after an abort request…", the observer stream closes early because its drain threw D1.
- Diagnostic run `logs/inngest-observe-d1-diagnostic.log` with `logs/d1-diagnostic.patch` applied: 20 passed, 1 expected fail, 6 skipped, exit 0.
  - The patch was reverted and never committed.
- Failing tests on main (all under `[inngest]`):
  - observe-approval-resume: follows the approved run to its finish and replays both segments
  - observe-reattach (COR-1409): reconnect / offset / late / dead: an independent observer replays or closes without hanging
  - observe-lifecycle:
    - closes an observation of a run that never existed
    - replays a finished run, then closes
    - replays a run that ended in a provider error, then closes
    - stays open through a slow first token…
    - stays open while a slow tool runs between steps…
    - keeps observing across an approval suspend…
    - keeps observing a suspended run after an abort request…
    - an observer that aborts a run parked on approval releases it…
- Engine skips are by design: observe-state skips inngest, and observer-outcomes covers only the listed outcomes.
- With 4 workers, the dev server can hit a readiness timeout ("not ready after 30 attempts"). That is an infrastructure flake, so use 1 worker.

### Cell 2: Slow or stalled bus. PASS with limitation L1

Command:

```
cd pubsub/redis-streams && REDIS_URL=redis://localhost:6381 npx vitest run src/agent-stream-bus-stall.test.ts
```

Result: 13/13 passed at HEAD (`logs/final-c2.log`). Earlier runs: 12/12 twice, then 13/13.

The stall is real Redis `CLIENT PAUSE <ms> ALL`. The matrix is plain and durable agents, each with an in-memory cache and with a Redis server cache.

- **3s stall:** caller, live observer and replay each received all 20 frames, in order.
  - Plain agent with in-memory cache: caller closed in about 16ms.
  - Plain agent with Redis cache: stream() waited about 3.07s for run-record writes.
  - Durable agent: caller waited about 3.1s for read-back.
- **12s stall on a connected bus** (longer than the 10s `LOGGED_EVENT_DELIVERY_TIMEOUT_MS`): every cell delivered every frame.
- **Backlog:** 10 concurrent plain runs started during a 5s `CLIENT PAUSE ALL` (`logs/final-c2.log`, `[COR-1519 backlog]` line).
  - Accounting method: a test-only `RedisStreamsPubSub` subclass counts `publish()` calls on `agent.stream.*` topics: *started* (entered publish), *acked* (publish resolved), *in flight* (started minus acked). No runtime instrumentation. `agent.control.*` topics and run-record cache writes are NOT counted.
  - Produced: 200 frames reached callers (10 runs × 20 frames) by ~100–135ms. The stream topic carries the same 20 events per run, lifecycle events (step-start/step-finish/finish) included, so 200 bus publishes were owed.
  - At callers-done: started=10, acked=0, so 10 publishes were in flight (one per run; each run's chain is serial) and 190 had not yet reached the bus. Unacked total 200.
  - "≥200 queued in process" is an **inference/lower bound**: it is produced-minus-acked on stream topics only. Exact per-run queue length was not read (the chain is a private promise), and the publisher's initial `running` record write plus any control traffic would be additional.
  - After unpause: all 200 acked; drained ~100–160ms after the pause ended. Replays complete.
  - Heap delta was GC noise and is not meaningful. Memory growth under a long stall was not measured.
- **L1:** a durable agent with in-memory cache, on a cold (never connected) bus stalled longer than 5s, fails the run cleanly.
  - The error is "write client did not connect to Redis within 5000ms".
  - Replay contains only the error frame.
  - The next run on the same instance works.

### Cell 3: Supervisor with plain, durable and evented sub-agents. PASS

Command:

```
cd packages/core && npx vitest run src/agent/streams/__tests__/supervisor-subagent-runs.test.ts
```

Result: 6/6 passed (`logs/final-c3.log`).

- **Fresh delegation:**
  - The sub-agent gets its own runId and topic. The parent runId is not passed (agent.ts ~6709). Only the resume path passes `suspendedToolRunId`.
  - Each topic has one finish, with no double publish and no text mixing.
  - Parent replay and child replay both match what was streamed.
- **Resumed delegation:**
  - Flow: the worker tool requires approval, then `supervisor.approveToolCall()` is called.
  - Both runs continue on their original topics, with no new run.
  - Each topic has one `suspended` event before the resume, one finish in total, and the correct text after the resume.
  - Replays match.
- Not covered: concurrent supervisors.

### Cell 4: Shipped browser Stop and reload path. PASS (HTTP/client level and real browser)

**4a. HTTP/client level** (committed test):

```
cd server-adapters/hono && npx vitest run src/__tests__/browser-stop-reload.test.ts
```

Result: 6/6 (`logs/final-c4.log`), plus 3 earlier runs with no flakes. Real MastraClient against a real Hono server, plain and durable agents, making the calls useChat makes on the signals path (`sendMessage`, `subscribeToThread({withRunStatus, withInitialHistory})`, `abortThread({expectedRunId})`): reload mid-run adopts `activeRunId`; Stop from sending tab; Stop from reloaded tab; stale Stop returns `aborted=false`; next message works.

**4b. Real browser, shipped Studio UI** (disposable fixture, not committed to source paths; in `studio-browser/`):

```
cd .artifacts/cor-1519/studio-browser && pnpm install && npx playwright test -c e2e/playwright.config.ts
```

Result: 6/6, 3 consecutive runs (`logs/final-c4-browser-run1.log`, `run2.log`; first run console only), ~27s each.

- Setup: headless Chromium (Playwright 1.64.1, Chrome Headless Shell 156.0.8078.4) driving the Studio bundled by the repo CLI (`mastra dev`, cli dist built from baseline) on :4111. Isolated project links local core/memory/libsql/cli; LibSQL file storage; `Memory()`; agents `plain-agent` and `durable-agent` (`createDurableAgent`) with a gated `wait` tool. Model is AIMock (LLMock 1.47.0) over HTTP on :4319, keyed on a predicate (tool call, then "The wait is over." after the tool result). Fixture-only routes `/cor1519/state|release|reset` expose tool counters and the gate. No repo source, dependency or workflow changes.
- Observed shipped transport: Studio issues `POST /api/agents/:id/threads/subscribe` and `POST /api/agents/:id/send-message` (signals path). The stop control is the composer button with accessible name "Cancel".
- Cases, each for plain and durable:
  1. **Cancel mid-tool:** browser sends `POST …/threads/abort` with `{threadId, expectedRunId}`; server tool sees the abort (started 1, aborted 1, finished 0); AIMock gets exactly 1 request (no follow-up model call); UI returns to "Send" and never shows the reply; after page reload the user message is shown, no reply in UI or persisted thread messages.
  2. **Reload mid-run:** after reload the UI shows the user message and the "Cancel" control (re-attached to the live run). Releasing the tool, the reply appears exactly once in the UI, UI returns to "Send", tool finished once, AIMock got 2 requests, and the persisted thread holds the reply once.
  3. **Reload then Cancel:** Cancel from the reloaded tab sends `threads/abort`, tool aborted, 1 model request, UI idle; a new message in the same thread runs to completion and renders its reply.
- So the shipped UI does reconnect after reload on this path; no missing-reconnect behavior was found.
- Not covered: legacy-stream / generate / network chat modes, multiple simultaneous tabs, Studio served from a production `mastra build`, and non-Chromium browsers. Spec is not in `packages/playground/e2e` (that suite mocks models in-process); it lives with the artifacts.

### Cell 5: Real remote Redis under load. UNVERIFIED

There is no approved remote endpoint in the environment. The PR 3 latency figures remain local/emulated only.

## Defects for follow-up tickets (not fixed here)

- **D1:** `InngestAgent.observe().fullStream` throws "Cannot read private member #options from an object whose class did not declare it".
  - Location: `workflows/inngest/src/durable-agent/create-inngest-agent.ts:2292` calls `baseFullStream.call(output)` with the destructurable Proxy as the receiver.
  - Core uses `.call(this)` instead.
  - The existing scenarios above reproduce it, so no new test is needed.
  - Origin: the private `#options` read in the getter came from #29263 (234d7a3e) and the `baseFullStream` wrapper from #28424 (a0068a9a). That this combination introduced the regression is **UNPROVEN**: no paired before/after run was done.

## Limitations

- L1 (cold-bus durable connect timeout) is described above.
- The plain publisher queue is unbounded. Only depth was measured, not memory under a long stall.
- Cell 4 real-browser evidence covers the default signals transport in Chromium only, from a disposable fixture outside the repo test suites.
- Cell 5 is unverified.
- All Redis evidence is local Docker. Emulated RTT was not used and would not count as remote evidence.

## Long Redis outage (local Docker), Nov 10 rerun on current main

Provenance:
- Baseline origin/main 66c620c0, merged into the session branch as 82fffe73.
- Dists rebuilt from that tree 15:52–15:53Z.
- node 22.23.3, pnpm 11.21.0, Docker 29.9.1, redis:7-alpine 7.4.12 on :6381, aimock 1.47.0. Host: 4 CPUs, 8GB.

Test: `pubsub/redis-streams/src/agent-stream-bus-outage.test.ts`. It is opt-in and test-only.

Command:

```
cd pubsub/redis-streams && COR1519_OUTAGE_SECONDS=60,120,300 COR1519_OUTAGE_OUT=<dir> REDIS_URL=redis://localhost:6381 npx vitest run src/agent-stream-bus-outage.test.ts
```

Run 15:59–16:17Z, 1082s. Result: 5 passed, 1 failed (outage-300s). Log: `logs/outage-60-120-300.log`. JSON timelines: `outage/`.

Load:
- 5 concurrent plain Agent runs plus 1 DurableAgent run (d0), all on one Mastra instance.
- Public `agent.stream()` per run, and a live `agent.observe()` per plain run.
- The model is AIMock over HTTP, streaming 16-char chunks every 50ms (20 chunks/s per run). Each stream lasts 5s lead + outage + 10s tail.
- Outage method: `docker pause` on the Redis container, starting 5s into the run.
- Quiet baselines use the same runs and the same stream length with no pause.
- Memory: `process.memoryUsage()` sampled every 2s after a forced GC. Reported as the peak delta over the phase start.

Accounting:
- A test-only RedisStreamsPubSub subclass counts publishes started, acked and failed per run on `agent.stream.*` topics.
- "Pending (inferred)" = frames produced to callers − acked − failed. This is a lower bound for the plain publisher's queue: in-flight publishes are included, and lifecycle/record writes are not counted.
- The Redis stream contents are verified directly with XRANGE.

| phase | chunks/run | bus started/acked/failed | peak pending (inferred) | backlog flushed after recovery | all settled after recovery | peak Δ rss / heap / external MB |
|---|---|---|---|---|---|---|
| quiet-60s | 1500 | 9037/9037/0 | 4 | – | – | +14.6 / +20.6 / +2.7 |
| outage-60s | 1500 | 9037/9037/0 | 5925 | 1.1s | 11.4s | +6.2 / +8.4 / +2.5 |
| quiet-120s | 2700 | 16237/16237/0 | 4 | – | – | +11.9 / +21.5 / +5.0 |
| outage-120s | 2700 | 16237/16237/0 | 11832 | 2.3s | 12.6s | +10.1 / +11.8 / +3.4 |
| quiet-300s | 6300 | 37837/37837/0 | 5 | – | – | +22.2 / +52.2 / +2.2 |
| outage-300s | 6300 | 31629/31617/12 | 29290 | 4.9s | 18.2s | +12.7 / +19.1 / +6.0 |

Memory: at this load (~29k pending frames of 16 chars each), the outage memory deltas are within the noise of the matched quiet runs. No growth attributable to the queue was measurable. Larger payloads or more runs were not tested.

60s and 120s: PASS.
- Every caller, live observer, observe() replay and Redis stream was exact.
- No publish failures.
- Caveat: the 120s pause lasted 120.09s, right at the 120s `publishRetryBudgetMs` default, so that cell doesn't show where the budget boundary falls.

300s: FAIL (strict assertions kept).
- Plain runs (p0–p4):
  - Each run had 2 publishes rejected with `PublishRetryBudgetExhaustedError` ("publish did not reach Redis within 120000ms").
  - Even so, every caller, observer, replay and Redis XRANGE was exact: 6306 entries per run, no loss and no duplicates. The rejected XADDs were still in node-redis's offline queue and landed after the unpause.
  - Failing assertions: `failed = 0` and `acked = caller frames`.
  - Finding F1: the publisher's failure accounting and warnings report frames as lost when they were actually delivered. Duplicates are possible in principle (retry after a lost reply) but were not observed.
- Durable run (d0):
  - FAILED. Its first stalled publish (index 97, 16:12:00Z) exhausted the 120s budget, and the run failed with `PublishRetryBudgetExhaustedError`. The error chunk was produced at 16:14:00Z.
  - The caller received nothing until Redis returned at ~305.8s. It then got 99 frames ending `error,error`, with 1504 of 100800 chars of text.
  - Replay and Redis hold the same truncated run plus the error frames.
  - Finding F2 (candidate defect, needs Nik to decide): during an outage longer than 120s, a DurableAgent run is failed after ~120s, but the caller's read-back stays silent until the bus recovers, so the failure is invisible for the rest of the outage. The model output after the stall is lost.
  - This matches the documented retry budget, so F2 may be considered by design. It is reported, not fixed.

Not covered: `docker stop/start` (connection loss, as opposed to a hung connection), multiple processes, payloads larger than 16-char chunks, more than 6 concurrent runs.
