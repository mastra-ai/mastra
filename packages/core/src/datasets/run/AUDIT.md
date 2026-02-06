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

### P0 — HIGH SEVERITY ✅ FIXED (PR #12789)

#### 1. ~~No per-item timeout~~ → FIXED

Added `itemTimeout` to `RunConfig`. Composes `AbortSignal.timeout()` with run-level signal via `AbortSignal.any()`. `raceWithSignal` in `executor.ts` ensures timeout is honored even if the target ignores the signal.

#### 2. ~~AbortSignal not forwarded to targets~~ → FIXED

Signal is now forwarded to `agent.generate()` as `abortSignal`. Workflow limitation remains — `workflow.start()` does not accept a signal (see Follow-Up Work).

#### 3. ~~`addResult` failure kills entire run~~ → FIXED

`runsStore.addResult()` is now wrapped in try/catch with `console.warn`. Storage failures are non-fatal.

#### 4. ~~`generateLegacy` silent false success~~ → FIXED

Added explicit null check after `generateLegacy?.()` call. Missing method now throws with a descriptive error message.

---

### P1 — MEDIUM SEVERITY

#### 5. ~~Abort loses partial results~~ → FIXED (PR #12789, P0 round)

Abort now returns a partial `RunSummary` with `status: 'failed'` instead of throwing. Callers check `result.status` instead of catching `AbortError`.

#### 6. ~~Memory accumulation at scale~~ → PARTIALLY FIXED (PR #12797 + streaming PR)

- P1: Added `retainResults?: boolean` to `RunConfig` (default `true`). Server handler uses `retainResults: false`.
- Streaming: Added `onItemComplete` callback. When provided, `retainResults` auto-defaults to `false` (zero memory accumulation).

#### 7. ~~No retry for transient failures~~ → FIXED (PR #12797)

Added `maxRetries` and `retryDelay` to `RunConfig`. Exponential backoff with jitter. `isTransientError` string-pattern heuristic determines retryability.

#### 8. ~~Sequential scorers per item~~ → FIXED (PR #12797)

Replaced `for` loop with `Promise.allSettled` in `runScorersForItem`. Scorers now run in parallel per item.

#### 9. ~~Run status logic — no partial failure~~ → FIXED (PR #12797)

Added `completedWithErrors: boolean` to `RunSummary` (true when `failedCount > 0 && succeededCount > 0`). `RunStatus` enum unchanged — no storage migration needed.

#### 10. ~~In-flight counter accuracy on abort~~ → FIXED (PR #12797)

Added `skippedCount` to `RunSummary`, computed as `items.length - succeededCount - failedCount`. Not stored — derived at return time.

---

### P2 — LOW SEVERITY

#### 11. ~~Results order is non-deterministic~~ → FIXED (PR #12797)

Results are now stored in a pre-allocated array indexed by item position. Output order matches input order.

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

## TEST COVERAGE

56 tests across 5 files. All use mock agents/workflows — no LLM calls.

| File                           | Tests | Covers                                                                                                                    |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `p0-regression.test.ts`        | 5     | Abort partial summary, generateLegacy null check, per-item timeout, signal forwarding, addResult resilience               |
| `p1-regression.test.ts`        | 13    | Parallel scorers, error isolation, completedWithErrors, skippedCount, results ordering, retainResults, retry with backoff |
| `streaming-regression.test.ts` | 7     | onItemComplete callback, smart retainResults default, success+failure items, throw resilience, async await, abort         |
| `runDataset.test.ts`           | 18    | Core orchestration, scorer isolation, concurrency, workflows, abort                                                       |
| `executor.test.ts`             | 13    | Agent/workflow/scorer dispatch, v1 agent, NaN scores                                                                      |

---

## FOLLOW-UP WORK

| Item                      | Status | Description                                                                                                                       | Where                          |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| UI: `completedWithErrors` | TODO   | Display partial failure badge/indicator in Playground run details                                                                 | `packages/playground-ui`       |
| UI: `skippedCount`        | TODO   | Show skipped item count in run summary view when abort occurs                                                                     | `packages/playground-ui`       |
| Workflow abort            | TODO   | `workflow.start()` does not accept `AbortSignal` — per-item timeout works but in-flight workflow runs to completion in background | `packages/core/src/workflows/` |
| Memory: `onItemComplete`  | DONE   | `onItemComplete` callback + smart `retainResults` default enables zero-memory streaming                                           | `types.ts`, `index.ts`         |
| Memory: streaming results | DONE   | Server handler uses `retainResults: false` since it's fire-and-forget                                                             | `datasets.ts` (server)         |
| Dynamic p-map import      | TODO   | `p-map` is dynamically imported on every `runDataset` call (P2)                                                                   | `index.ts:115`                 |
