# Dataset Run Executor — Audit

Combined analysis from two independent audits of the run executor (`packages/core/src/datasets/run/`).

---

## FILES ANALYZED

- `index.ts` — orchestrator (`runDataset`, `resolveTarget`)
- `executor.ts` — target execution (`executeTarget`, `executeAgent`, `executeWorkflow`, `executeScorer`)
- `scorer.ts` — scorer resolution and execution (`resolveScorers`, `runScorersForItem`, `runScorerSafe`)
- `types.ts` — type definitions (`RunConfig`, `ItemResult`, `ScorerResult`, `ItemWithScores`, `RunSummary`)

---

## WHAT WORKS WELL

| Area                     | Details                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Concurrency control      | `p-map` with `maxConcurrency` (default 5). No unbounded `Promise.all`.                                |
| Item failure isolation   | `executeTarget` catches errors at both inner and outer level. One item failing doesn't crash the run. |
| Scorer failure isolation | `runScorerSafe` wraps each scorer independently. One scorer crashing doesn't affect others.           |
| Score persistence        | `validateAndSaveScore` is wrapped in try/catch with `console.warn`. Best-effort, non-blocking.        |

---

## ISSUES FOUND

### P0 — HIGH SEVERITY

#### 1. No per-item timeout

A hanging `agent.generate()` or `workflow.start()` blocks a concurrency slot indefinitely. The only escape is the caller-provided `AbortSignal`, which requires external setup.

- **Location:** `index.ts:129` (`executeTarget` call)
- **Impact:** A single hung target can stall the entire run

#### 2. AbortSignal not forwarded to targets

The signal check at `index.ts:121` only prevents _starting_ new items. It cannot interrupt in-flight LLM calls. Signal is not passed to `agent.generate()` or `workflow.createRun()`.

- **Location:** `index.ts:121-123`, `executor.ts:107`, `executor.ts:136`
- **Impact:** Abort is cooperative-only — long-running targets ignore it

#### 3. `addResult` failure kills entire run

`runsStore.addResult()` at `index.ts:170` is inside the p-map callback but has no try/catch. If storage throws, the error propagates to p-map, which aborts the entire run. A storage hiccup kills all remaining items.

- **Location:** `index.ts:170-184`
- **Impact:** Storage transient failure = total run failure, even though target execution succeeded

#### 4. `generateLegacy` silent false success

When `isSupportedLanguageModel()` returns `false` and `generateLegacy` is `undefined`, the optional chain `agent.generateLegacy?.()` returns `undefined`. This flows back as `{ output: undefined, error: null }` — a false success with no output.

- **Location:** `executor.ts:111-114`
- **Impact:** Items silently marked as succeeded with `undefined` output

---

### P1 — MEDIUM SEVERITY

#### 5. Abort loses partial results

When abort fires mid-run, the catch block (`index.ts:194-213`) updates the run status to `failed` in storage, then re-throws the `AbortError`. The caller receives an exception — not a `RunSummary`. Items that completed successfully before the abort are persisted individually via `addResult`, but the function returns nothing useful to the caller.

- **Location:** `index.ts:194-213`
- **Impact:** Caller gets no partial summary. Must reconstruct from storage.

#### 6. Memory accumulation at scale

`results: ItemWithScores[]` at `index.ts:112` grows unboundedly. All outputs are held in RAM until the function returns. Agent/workflow outputs can be large (full LLM responses with metadata).

- **Location:** `index.ts:112`, `index.ts:187-190`
- **Impact:** At 1000+ items with large outputs, significant heap pressure. At 10k+, risk of OOM.

#### 7. No retry for transient failures

`retryCount` is hardcoded to `0` at `index.ts:152`. The field exists in `ItemResult` but is never used. A transient LLM API error (rate limit, timeout, 503) permanently fails the item.

- **Location:** `index.ts:152`, `types.ts:49`
- **Impact:** Transient errors are treated as permanent. No recovery.

#### 8. Sequential scorers per item

Scorers run serially in a `for` loop at `scorer.ts:53`. Each scorer (often an LLM call) must complete before the next starts. With N scorers, each p-map slot is occupied N× longer than necessary.

- **Location:** `scorer.ts:53-86`
- **Impact:** 5 scorers × 100ms each = 500ms holding a concurrency slot. Effective throughput reduced by scorer count.

#### 9. Run status logic — no partial failure

`status = failedCount === items.length ? 'failed' : 'completed'` at `index.ts:217`. A run where 999/1000 items fail is marked `completed`.

- **Location:** `index.ts:217`
- **Impact:** Callers cannot distinguish clean success from nearly-total failure without inspecting individual results.

#### 10. In-flight counter accuracy on abort

When abort fires, items currently in-flight within p-map won't have incremented `succeededCount`/`failedCount`. The counts stored in the run record may be less than the actual completed items.

- **Location:** `index.ts:136-139`, `index.ts:198-206`
- **Impact:** Run record has inaccurate counts after abort.

---

### P2 — LOW SEVERITY

#### 11. Results order is non-deterministic

`results.push()` at `index.ts:187` appends in completion order, not input order. With concurrent execution, faster items appear first.

- **Location:** `index.ts:187`
- **Impact:** Consumers expecting input-order results will get wrong ordering.

#### 12. Dynamic import of p-map on every call

`await import('p-map')` at `index.ts:115` runs on every `runDataset` invocation. Minor overhead per call.

- **Location:** `index.ts:115`
- **Impact:** Negligible for most use cases. Could be hoisted.

---

## NOT AUDITED

- Behavior when `getItemsByVersion` returns items with missing/malformed `input` fields
- Side effects or performance of the `resolveTarget` fallback chain (`getAgentById` → `getAgent`)
- Thread safety of `validateAndSaveScore` under concurrent writes
- Behavior when `datasetsStore` and `runsStore` point to different storage backends

---

## TEST PLAN

All tests use mock targets (no LLM calls). Mock agents/workflows/scorers with configurable delay, output size, and failure rate.

### Mock Infrastructure

| Component       | Mock                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `Mastra`        | `getStorage()`, `getAgentById()`, `getScorerById()`                    |
| `Agent`         | `generate()` — configurable delay/response/failure                     |
| `Workflow`      | `createRun()` returning mock run with `start()`                        |
| `MastraScorer`  | `run()` — configurable delay/score/failure                             |
| `runsStore`     | `createRun`, `updateRun`, `addResult` — spy-able, configurable failure |
| `datasetsStore` | `getDatasetById`, `getItemsByVersion` — returns canned items           |

### Tests by Issue

#### T1 — Per-item timeout (Issue #1)

- Mock target: hangs forever (never resolves)
- 5 items, `maxConcurrency: 5`
- No `AbortSignal` provided
- **Expected:** run never completes (proves no timeout exists)
- Use `Promise.race` with a test-level timeout to avoid hanging the test suite

#### T2 — AbortSignal not forwarded (Issue #2)

- Mock target: takes 5 seconds, checks no signal internally
- 1 item
- Abort after 100ms
- **Expected:** item is NOT interrupted. Abort only checked before next item starts.
- Verify `executeTarget` completes its full 5s despite abort

#### T3 — `addResult` failure kills run (Issue #3)

- Mock target: always succeeds
- Mock `runsStore.addResult`: throws on 3rd call
- 10 items, `maxConcurrency: 1` (sequential for determinism)
- **Expected:** run fails after item 3. Items 4-10 never execute.
- Verify `updateRun` called with `status: 'failed'`

#### T4 — `generateLegacy` silent undefined (Issue #4)

- Mock agent: `isSupportedLanguageModel()` returns false, no `generateLegacy` method
- Call `executeTarget(agent, 'agent', item)`
- **Expected:** `{ output: undefined, error: null }` — false success

#### T5 — Abort loses partial results (Issue #5)

- Mock target: 100ms per item
- 20 items, `maxConcurrency: 5`
- Abort after 250ms
- **Expected:** function throws `AbortError`. No `RunSummary` returned.
- Verify `addResult` was called for completed items (data exists in storage)
- Verify caller gets zero usable data from the thrown error

#### T6 — Memory accumulation (Issue #6)

- Mock target: returns 1MB string per item
- 500 items, `maxConcurrency: 50`
- Snapshot `process.memoryUsage().heapUsed` before and after
- **Expected:** heap delta > 500MB (all outputs held simultaneously)

#### T7 — No retry (Issue #7)

- Mock target: fails on first call per item, succeeds on retry
- Track call count per item via `Map`
- 10 items
- **Expected:** all 10 fail. Each item called exactly once. `retryCount` is 0.

#### T8 — Sequential scorers bottleneck (Issue #8)

- Mock target: 0ms
- 3 mock scorers: 100ms each
- 20 items, `maxConcurrency: 20`
- Measure wall clock with scorers vs without
- **Expected:** ~300ms with scorers (serial), ~0ms without. Ratio proves bottleneck.

#### T9 — Status logic (Issue #9)

- Mock target: fails 99 out of 100 items
- **Expected:** `status === 'completed'` despite 99% failure rate

#### T10 — Results ordering (Issue #11)

- Mock target: item 0 = 200ms, item 1 = 50ms, item 2 = 10ms
- `maxConcurrency: 3`
- **Expected:** `results[0].itemId` is item 2 (fastest), not item 0

#### T11 — Backpressure from slow storage (Issue #3 related)

- Mock target: 10ms
- Mock `addResult`: 500ms
- 50 items, `maxConcurrency: 10`
- **Expected:** wall clock ~2500ms (dominated by storage, not execution)
- Compare against 0ms storage: ~50ms. Ratio ~50x proves storage is in hot path.

---

## FOLLOW-UP WORK

| Item                      | Description                                                                                                                       | Where                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| UI: `completedWithErrors` | Display partial failure badge/indicator in Playground run details                                                                 | `packages/playground-ui`       |
| UI: `skippedCount`        | Show skipped item count in run summary view when abort occurs                                                                     | `packages/playground-ui`       |
| Workflow abort            | `workflow.start()` does not accept `AbortSignal` — per-item timeout works but in-flight workflow runs to completion in background | `packages/core/src/workflows/` |
| Memory: streaming results | `retainResults: false` is a workaround; true fix is streaming/paginated result delivery                                           | `index.ts`                     |
| Dynamic p-map import      | `p-map` is dynamically imported on every `runDataset` call (P2)                                                                   | `index.ts:115`                 |
