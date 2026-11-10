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
