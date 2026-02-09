# Dataset Run Executor — Audit

## OVERVIEW

The executor runs dataset items against a target (agent, workflow, or scorer) concurrently via `p-map`, scores results, and persists them to storage. This audit covers load handling, failure modes, and scale concerns.

---

## FILES

| File                 | Role                                                            |
| -------------------- | --------------------------------------------------------------- |
| `index.ts`           | Orchestrator — `runDataset()` drives the run loop               |
| `executor.ts`        | Target dispatch — `executeTarget()` → agent / workflow / scorer |
| `scorer.ts`          | Score computation + persistence — `runScorersForItem()`         |
| `types.ts`           | Shared types                                                    |
| `analytics/index.ts` | Post-run analytics computation                                  |

---

## BUGS

### 1. Abort loses partial results

**Location:** `index.ts:194`

If `p-map` throws (e.g., on abort), the catch block updates the run to `failed` and re-throws. No `RunSummary` is returned, so all partial results collected up to that point are lost.

**Fix:** Return a `RunSummary` with partial data instead of re-throwing.

---

### 2. Abort leaves counts incomplete

**Location:** `index.ts:199`

When aborted mid-run, `succeededCount` and `failedCount` only reflect items processed so far. The final status update uses these incomplete counts.

**Fix:** Track `processedCount` separately and include `skippedCount = items.length - processedCount` in the summary.

---

### 3. `generateLegacy?.()` silent undefined

**Location:** `executor.ts:101-129`

In `executeAgent`, if `generateLegacy` is `null`/`undefined`, the optional call returns `undefined` silently. The result is treated as a success with no output.

**Fix:** Guard with an explicit check and throw if the generate method is unavailable.

---

## ISSUES

### 4. AbortSignal not forwarded to targets

**Location:** `index.ts:121`, `executor.ts`

`AbortSignal` is checked at the top of each `p-map` iteration but is never passed to `agent.generate()` or `workflow.createRun()`. An in-flight LLM call will run to completion even after abort.

**Fix:** Forward the signal to `agent.generate({ abortSignal })` and `workflow.createRun({ signal })`.

---

### 5. No per-item timeout

A hanging agent/workflow call blocks a `p-map` slot indefinitely. With `maxConcurrency: 5`, one stuck call reduces throughput by 20%.

**Fix:** Wrap `executeTarget` in `AbortSignal.timeout(ms)` or equivalent.

---

### 6. Scorers run sequentially per item

**Location:** `scorer.ts:53`

`for (const scorer of scorers)` runs each scorer one after another within a single item callback. If a scorer is slow (e.g., LLM-as-judge), it blocks the `p-map` slot.

**Fix:** Run scorers in parallel with `Promise.all` or `Promise.allSettled`.

---

### 7. Score persistence is inline and unbatched

**Location:** `scorer.ts:59-85`, `index.ts:170`

`validateAndSaveScore` is called inline per scorer per item, and `runsStore.addResult()` is called per item. With 1,000 items × 3 scorers, that's 4,000 sequential-per-item storage writes with no batching.

**Fix:** Batch writes or use a write queue with configurable flush interval.

---

### 8. No backpressure on storage failures

**Location:** `scorer.ts:81-84`

Score save errors are caught and logged with `console.warn`. There is no signal to the orchestrator that persistence is failing. A bad storage connection silently drops all scores.

**Fix:** Track save failure count. If it exceeds a threshold, surface it in the `RunSummary` or abort.

---

### 9. Workflow `suspended`/`paused` treated as errors

**Location:** `executor.ts:157-162`

Workflows returning `suspended` or `paused` status are treated as execution errors. These may be valid intermediate states depending on workflow design.

**Fix:** Decide on semantics — either document that only `completed` is valid, or add a wait/resume mechanism.

---

### 10. `retryCount` is hardcoded to 0

**Location:** `index.ts:152`

`retryCount` is set to `0` and never incremented. It's stored in results but serves no purpose.

**Fix:** Implement retry logic or remove the field.

---

## MINOR CONCERNS

### 11. Unbounded `results` array in memory

**Location:** `index.ts:112`

`results: ItemWithScores[]` grows without bound. For large datasets (10k+ items with scores), this could cause memory pressure.

---

### 12. Non-deterministic result order

`results.push()` order depends on `p-map` completion order, not item order. This is safe in Node's event loop but may confuse consumers expecting ordered results.

---

### 13. Partial failure marked as `completed`

**Location:** `index.ts:217`

`status = failedCount === items.length ? 'failed' : 'completed'`. A run where 999/1000 items failed is still `completed`. Consider adding a `partial` status or `completedWithErrors`.

---

### 14. Dynamic import on every call

**Location:** `index.ts:115`

`p-map` is dynamically imported on every `runDataset()` invocation. Minor overhead, easily cached.

---

## SCALE CONCERNS

| Items        | Risk     | Detail                                                                                                                         |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| < 100        | Low      | Works fine with defaults                                                                                                       |
| 100–1,000    | Medium   | Memory OK; long wall-clock time; storage write volume notable                                                                  |
| 1,000–10,000 | High     | Memory pressure from `results[]`; 4× storage writes per item (result + scorers); no timeout means one stuck item blocks a slot |
| 10,000+      | Critical | Unbounded memory; no streaming/pagination of results; storage becomes bottleneck                                               |

---

## TEST COVERAGE GAPS

- Large dataset (1,000+ items)
- Abort mid-execution (partial results)
- Storage write failure during run
- Per-item timeout / hanging target
- Scorer parallel execution
- `generateLegacy` returning `undefined`

---

## RECOMMENDED PRIORITY

| Priority | Item                                 | Effort |
| -------- | ------------------------------------ | ------ |
| P0       | #1 Abort loses partial results       | Small  |
| P0       | #3 `generateLegacy` silent undefined | Small  |
| P1       | #4 Forward AbortSignal to targets    | Medium |
| P1       | #5 Per-item timeout                  | Medium |
| P1       | #8 Backpressure on storage failures  | Medium |
| P2       | #6 Parallel scorers                  | Small  |
| P2       | #7 Batch storage writes              | Medium |
| P2       | #9 Workflow suspended semantics      | Small  |
| P3       | #10 Remove or implement retryCount   | Small  |
| P3       | #11 Streaming results for large sets | Large  |
| P3       | #13 Partial failure status           | Small  |
