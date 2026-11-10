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
| Browser | Playwright 1.64.1. Chrome Headless Shell 156.0.8078.4 is installed and launches. It was used only to check availability. |

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
- **Backlog:** 10 concurrent plain runs during a 5s pause.
  - Callers finished in about 100–135ms with 200 frames.
  - At that moment the bus had started 10 publishes and acknowledged 0, so at least 200 frames were queued in process.
  - Peak concurrent publishes was 10, one per run because each run's chain is serial.
  - The queue drained about 100–160ms after the pause ended. Replays were complete.
  - Heap delta was GC noise and is not meaningful.
  - The queue is unbounded. Total memory under a long stall was not measured.
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

### Cell 4: Shipped browser Stop and reload path. PASS at the HTTP/client level

Command:

```
cd server-adapters/hono && npx vitest run src/__tests__/browser-stop-reload.test.ts
```

Result: 6/6 passed (`logs/final-c4.log`). Earlier runs: 3 in a row with no flakes.

- Studio defaults to thread signals. The client calls useChat makes are:
  - `sendMessage`
  - `subscribeToThread({withRunStatus, withInitialHistory})`
  - `abortThread({expectedRunId})`
- The test runs those calls through a real MastraClient against a real Hono server, for plain and durable agents. Cases:
  - reload mid-run adopts `activeRunId`
  - Stop from the sending tab
  - Stop from a reloaded tab
  - a stale Stop returns `aborted=false`
  - the next message works
- Not covered:
  - a real browser rendering Studio
  - the React hook itself
  - legacy-stream mode
- Browser infrastructure is available now: Chromium launches after `playwright install chromium` plus `install-deps`. However, the kitchen-sink Studio e2e app mocks the model in-process with recorded fixtures, not at the HTTP edge. A Studio browser run that follows this brief's AIMock rule would need a new kitchen-sink agent pointed at AIMock. That was not done.

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
- Cell 4 does not drive a real browser.
- Cell 5 is unverified.
- All Redis evidence is local Docker. Emulated RTT was not used and would not count as remote evidence.
