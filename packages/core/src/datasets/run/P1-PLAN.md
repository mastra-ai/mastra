# P1 Dataset Run Executor: Test-first fixes

## Overview

Fix 5 P1 issues + 1 bonus P2 from both audit files (`AUDIT.md` + `AUDIT-MC.md`) using test-first. Write failing tests in a dedicated regression file, fix the code, verify. All tests use mock agents/workflows — no real LLM calls.

**Prerequisite**: P0 fixes merged via PR #12789 targeting `feat/datasets`.

---

## P1 Bugs (deduplicated from both audits)

| #   | Bug                                                          | File                                   | Line       | Priority |
| --- | ------------------------------------------------------------ | -------------------------------------- | ---------- | -------- |
| 6   | Memory accumulation — `results[]` grows unboundedly          | `index.ts:113`, `index.ts:199`         | P1         |
| 7   | No retry for transient failures — `retryCount` always 0      | `index.ts:160`, `types.ts:51`          | P1         |
| 8   | Sequential scorers per item — `for` loop blocks p-map slot   | `scorer.ts:53-86`                      | P1         |
| 9   | Run status logic — no partial failure status                 | `index.ts:234`                         | P1         |
| 10  | In-flight counter accuracy on abort — counts may be < actual | `index.ts:143-147`, `index.ts:206-218` | P1         |
| 11  | Results order non-deterministic                              | `index.ts:199`                         | P2 (bonus) |

### Deferred

| #   | Bug                                | Reason                                  |
| --- | ---------------------------------- | --------------------------------------- |
| 12  | Dynamic p-map import on every call | Negligible impact, not worth the churn. |

---

## Complexity Estimate

- **Size**: Medium (5 files modified, 1 new test file)
- **Risk**: Low-Medium — mostly additive changes, `RunStatus` type not changed
- **Dependencies**: None.

---

## Design Decisions

### Issue 6 — Memory accumulation

**Decision: Opt-in `retainResults: false` in `RunConfig`.**

Adopted from the other agent's plan. Full streaming/pagination is too large a refactor for P1, but we can provide an escape hatch:

- Default `true` — preserves current behavior, no breaking change
- When `false`, `results[]` stays empty. Counters (`succeededCount`, `failedCount`) still work. Storage persistence still works.
- Callers using `retainResults: false` must rely on `runsStore` for result retrieval instead of `RunSummary.results`.
- The `RunSummary.results` type stays `ItemWithScores[]` — it's just an empty array when `false`.

### Issue 7 — Retry logic

**Decision: Implement retry with configurable `maxRetries` in `RunConfig`.**

- Default: `0` (no retry, current behavior preserved)
- Only retry on transient errors (timeout, rate limit, 5xx, connection errors)
- `retryCount` in `ItemResult` reflects actual retries attempted
- Exponential backoff with jitter: `retryDelay * 2^attempt + random(0, retryDelay/2)` — prevents thundering herd when multiple runs hit the same API
- `retryDelay` configurable, default `1000ms`
- Re-check `signal?.aborted` after each delay — don't retry if aborted

### Issue 8 — Parallel scorers

**Decision: Replace `for` loop with `Promise.allSettled`.**

- `runScorerSafe` already catches errors, so `allSettled` always has `fulfilled` results
- Score persistence order becomes non-deterministic (within a single item) — acceptable since scores are keyed by `scorerId`
- Output `ScorerResult[]` order matches input `scorers[]` order via index mapping

### Issue 9 — Run status logic

**Decision: Keep `RunStatus` type as-is** (`'pending' | 'running' | 'completed' | 'failed'` at `packages/core/src/storage/types.ts:914`). Adding a new status requires storage schema migration + updating every storage adapter + client SDK types + playground UI.

Instead, add `completedWithErrors: boolean` to `RunSummary`:

- `true` when `status === 'completed' && failedCount > 0`
- Callers can distinguish clean success from partial failure without breaking existing `RunStatus` checks
- No storage migration. No adapter changes. No UI changes required (but UI can optionally render it).

### Issue 10 — Counter accuracy on abort

**Decision: Add `skippedCount` to `RunSummary`.**

- `skippedCount = totalItems - succeededCount - failedCount`
- Items mid-execution when abort fired never increment either counter — they are "skipped"
- Invariant: `succeededCount + failedCount + skippedCount === totalItems`
- NOT persisted to storage (no schema change needed). Computed from existing counters.

### Issue 11 — Results ordering

**Decision: Use pre-allocated array indexed by original position.**

- p-map passes `index` as second callback arg
- `results[index] = itemResult` instead of `results.push(itemResult)`
- On abort, incomplete items are `undefined` → filtered out
- No sort needed, deterministic order guaranteed

---

## Requirements

| Bug | Requirement                                      | Must Be True                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `retainResults: false` skips result accumulation | `RunSummary.results === []` when `retainResults: false`. Counters still accurate. Storage still persists. Default `true` preserves current behavior.                                                                                                                                                            |
| 7   | Retry with configurable `maxRetries`             | Item retried up to `maxRetries` times on transient error. `retryCount` reflects attempts. Success on retry → `succeededCount` incremented. Non-transient errors are NOT retried. Default `maxRetries: 0` preserves current behavior. `AbortError` is never retried. Abort during backoff stops further retries. |
| 8   | Parallel scorers                                 | `runScorersForItem` runs all scorers concurrently. Wall clock ≈ slowest scorer, not sum. Error isolation preserved per scorer.                                                                                                                                                                                  |
| 9   | `completedWithErrors` flag                       | `RunSummary.completedWithErrors === true` when `status === 'completed' && failedCount > 0`. `false` when all succeed or when aborted.                                                                                                                                                                           |
| 10  | Accurate counts on abort                         | `RunSummary.skippedCount >= 0`. `succeededCount + failedCount + skippedCount === totalItems` always holds.                                                                                                                                                                                                      |
| 11  | Deterministic results order                      | `results[i]` corresponds to `items[i]` from the dataset, regardless of completion order.                                                                                                                                                                                                                        |

---

## Steps

### Step 1 — Create regression test file

**File**: `packages/core/src/datasets/run/__tests__/p1-regression.test.ts` (NEW)

Follows existing patterns from `runDataset.test.ts` and `p0-regression.test.ts`:

- `InMemoryDB`, `DatasetsInMemory`, `RunsInMemory`
- `createMockAgent` factory with configurable delay/failure
- `vi.mock` for `isSupportedLanguageModel`

13 test cases (details below).

**Checkpoint — verify tests fail:**

After creating the test file, run:

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/p1-regression.test.ts
```

Expected: **all 13 tests fail** (or at most T-7b/T-10b pass as they test default behavior). This confirms the tests are correctly asserting behavior that doesn't exist yet.

| Test  | Expected failure reason                                                       |
| ----- | ----------------------------------------------------------------------------- |
| T-6a  | `retainResults` property doesn't exist on `RunConfig`                         |
| T-6b  | `retainResults` not implemented, results always populated                     |
| T-7a  | `retryCount` always 0, agent only called once                                 |
| T-7b  | May pass already (tests default behavior) — baseline test                     |
| T-7c  | `retryCount` always 0, non-retryable error not distinguished                  |
| T-7d  | Retry loop doesn't exist yet, can't test abort during backoff                 |
| T-8a  | Scorers run sequentially (~300ms+), wall clock assertion fails                |
| T-8b  | Scorer error isolation under parallelism not verified                         |
| T-9a  | `completedWithErrors` is `undefined` (property doesn't exist on `RunSummary`) |
| T-9b  | `completedWithErrors` is `undefined` (property doesn't exist on `RunSummary`) |
| T-10a | `skippedCount` is `undefined` (property doesn't exist on `RunSummary`)        |
| T-10b | May pass already (tests normal completion baseline)                           |
| T-11  | Results order matches completion order, not dataset order                     |

Do NOT proceed to Step 2 until you've confirmed the failures.

---

**Test details:**

**T-6a: retainResults false → empty results**

- Mock agent: always succeeds
- 3 items, `retainResults: false`
- Assert: `result.results.length === 0`
- Assert: `result.succeededCount === 3`
- Assert: `result.status === 'completed'`

**T-6b: retainResults true (default) → results populated**

- Mock agent: always succeeds
- 3 items, no `retainResults` set
- Assert: `result.results.length === 3`

**T-7a: Retry on transient failure**

- Mock agent: fails twice with "rate limit" error, succeeds on 3rd call
- 1 item, `maxRetries: 3`, `retryDelay: 10` (fast for tests)
- Assert: `result.succeededCount === 1`
- Assert: `result.results[0].retryCount === 2`
- Assert: `result.results[0].error === null`

**T-7b: No retry when `maxRetries` is 0 (default)**

- Mock agent: always fails
- 2 items, no `maxRetries` set
- Assert: each item's agent.generate called exactly once per item
- Assert: `result.results[0].retryCount === 0`

**T-7c: Non-retryable error is not retried**

- Mock agent: always fails with "Invalid input format" (non-transient error)
- 1 item, `maxRetries: 2`, `retryDelay: 10`
- Assert: `agent.generate` called exactly 1x
- Assert: `result.results[0].retryCount === 0`
- Assert: `result.failedCount === 1`

**T-7d: Abort during retry backoff stops retries**

- Mock agent: always fails with "rate limit" error
- 1 item, `maxRetries: 5`, `retryDelay: 50`
- `AbortController.abort()` after ~80ms (during first backoff delay)
- Assert: `agent.generate` called ≤ 2x (initial + at most 1 retry before abort)
- Assert: run resolves (does not hang)

**T-8a: Parallel scorers faster than sequential**

- Mock agent: instant success
- 3 mock scorers: each takes 100ms (`setTimeout`)
- 5 items, `maxConcurrency: 5`
- Measure wall clock time
- Assert: total time < 250ms (parallel ≈ 100ms per item) vs 300ms+ (serial = 3×100ms per item)
- Assert: each item has 3 scores with correct `scorerId`

**T-8b: Scorer error isolation under parallel execution**

- Mock agent: instant success
- 3 mock scorers: scorer 1 throws, scorers 2 and 3 succeed
- 1 item
- Assert: all 3 scorer results present
- Assert: scorer 1 has `error` non-null, `score === null`
- Assert: scorers 2 and 3 have valid scores, `error === null`

**T-9a: completedWithErrors true on partial failure**

- Mock agent: 1st item fails, 2nd succeeds
- `maxConcurrency: 1`
- Assert: `result.status === 'completed'`
- Assert: `result.completedWithErrors === true`
- Assert: `result.failedCount === 1`, `result.succeededCount === 1`

**T-9b: completedWithErrors false when all succeed**

- Mock agent: always succeeds
- 2 items
- Assert: `result.status === 'completed'`
- Assert: `result.completedWithErrors === false`

**T-10a: skippedCount on abort**

- Mock agent: 200ms delay per item
- 10 items, `maxConcurrency: 2`
- Abort after ~300ms
- Assert: `result.skippedCount > 0`
- Assert: `result.succeededCount + result.failedCount + result.skippedCount === result.totalItems`

**T-10b: skippedCount is 0 on normal completion**

- Mock agent: always succeeds instantly
- 3 items
- Assert: `result.skippedCount === 0`
- Assert: `result.succeededCount === 3`
- Assert: `result.succeededCount + result.failedCount + result.skippedCount === result.totalItems`

**T-11: Results in dataset order**

- Mock agent: item 0 → 200ms delay, item 1 → 50ms, item 2 → 10ms
- `maxConcurrency: 3`
- Assert: `result.results[0]` corresponds to items[0]
- Assert: `result.results[1]` corresponds to items[1]
- Assert: `result.results[2]` corresponds to items[2]

---

### Step 2 — Fix Issue 8: Parallel scorers

**File**: `packages/core/src/datasets/run/scorer.ts` (lines 53-86)

Replace the sequential `for` loop with `Promise.allSettled`:

```typescript
const scorerPromises = scorers.map(async (scorer) => {
  const result = await runScorerSafe(scorer, item, output, scorerInput, scorerOutput);

  if (storage && result.score !== null) {
    try {
      await validateAndSaveScore(storage, { ... });
    } catch (saveError) {
      console.warn(`Failed to save score for scorer ${scorer.id}:`, saveError);
    }
  }

  return result;
});

const settled = await Promise.allSettled(scorerPromises);
return settled.map(s =>
  s.status === 'fulfilled'
    ? s.value
    : { scorerId: 'unknown', scorerName: 'unknown', score: null, reason: null, error: String(s.reason) }
);
```

---

### Step 3 — Fix Issue 9: `completedWithErrors` flag

**File**: `packages/core/src/datasets/run/types.ts`

Add to `RunSummary`:

```typescript
/** True when run completed but some items failed */
completedWithErrors: boolean;
```

**File**: `packages/core/src/datasets/run/index.ts`

Set in both return paths:

- Normal completion: `completedWithErrors: status === 'completed' && failedCount > 0`
- Abort path: `completedWithErrors: false` (status is `'failed'`)

---

### Step 4 — Fix Issue 10: `skippedCount`

**File**: `packages/core/src/datasets/run/types.ts`

Add to `RunSummary`:

```typescript
/** Number of items not processed (aborted or never started) */
skippedCount: number;
```

**File**: `packages/core/src/datasets/run/index.ts`

Compute:

```typescript
const skippedCount = items.length - succeededCount - failedCount;
```

Include in both return paths (normal + abort).

---

### Step 5 — Fix Issue 11: Results ordering

**File**: `packages/core/src/datasets/run/index.ts`

Replace `results.push()` with pre-allocated array:

```typescript
const results: (ItemWithScores | undefined)[] = new Array(items.length);

// In p-map callback (p-map passes index as 2nd arg):
await pMap(items, async (item, index) => {
  ...
  results[index] = { ...itemResult, scores: itemScores };
}, { concurrency: maxConcurrency });

// After p-map:
const orderedResults = results.filter((r): r is ItemWithScores => r !== undefined);
```

On abort, incomplete items remain `undefined` and are filtered out.

---

### Step 6 — Fix Issue 6: Memory accumulation opt-out

**File**: `packages/core/src/datasets/run/types.ts`

Add to `RunConfig`:

```typescript
/** When false, results are not accumulated in memory. Use storage to retrieve results. Default: true. */
retainResults?: boolean;
```

**File**: `packages/core/src/datasets/run/index.ts`

Gate result accumulation:

```typescript
const { retainResults = true } = config;

// In p-map callback:
if (retainResults) {
  results[index] = { ...itemResult, scores: itemScores };
}

// Return path:
const orderedResults = retainResults ? results.filter((r): r is ItemWithScores => r !== undefined) : [];
```

---

### Step 7 — Fix Issue 7: Retry logic

**File**: `packages/core/src/datasets/run/types.ts`

Add to `RunConfig`:

```typescript
/** Maximum retry attempts per item on transient failure. Default: 0 (no retry). */
maxRetries?: number;
/** Base delay between retries in ms. Actual delay: retryDelay * 2^attempt + jitter. Default: 1000. */
retryDelay?: number;
```

**File**: `packages/core/src/datasets/run/index.ts`

Add transient error detector:

```typescript
function isTransientError(error: string): boolean {
  const patterns = [
    /timeout/i,
    /rate.?limit/i,
    /429/,
    /503/,
    /5\d\d/,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /socket hang up/i,
    /fetch failed/i,
  ];
  // Never retry abort errors
  if (/abort/i.test(error)) return false;
  return patterns.some(p => p.test(error));
}
```

Wrap `executeTarget` in retry loop inside p-map callback:

```typescript
const { maxRetries = 0, retryDelay = 1000 } = config;

// Inside p-map callback:
let execResult: ExecutionResult;
let retryCount = 0;

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  execResult = await executeTarget(target, targetType, item, { signal: itemSignal });

  if (!execResult.error || attempt === maxRetries) break;
  if (!isTransientError(execResult.error)) break;
  if (itemSignal?.aborted) break;

  retryCount = attempt + 1;
  const jitter = Math.random() * (retryDelay / 2);
  await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt) + jitter));

  // Re-check abort after delay
  if (itemSignal?.aborted) break;
}
```

Update `retryCount` in `itemResult` and `addResult` to use the computed value.

---

### Step 8 — Run tests and verify all pass

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/p1-regression.test.ts
cd packages/core && pnpm vitest run src/datasets/run/__tests__/
```

**Checkpoint — verify tests pass:**

Expected: **all 13 P1 tests pass**, plus all existing tests (P0 regression + original) pass unchanged.

| Test  | Expected result                                                 |
| ----- | --------------------------------------------------------------- |
| T-6a  | ✅ `results === []`, counters correct                           |
| T-6b  | ✅ `results.length === 3`, backward compat                      |
| T-7a  | ✅ Agent retried, `retryCount === 2`, succeeded                 |
| T-7b  | ✅ No retry, agent called once per item                         |
| T-7c  | ✅ Non-retryable error, called 1x, `retryCount === 0`           |
| T-7d  | ✅ Abort during backoff, ≤2 calls, run resolves                 |
| T-8a  | ✅ Wall clock < 250ms for 3×100ms scorers                       |
| T-8b  | ✅ Scorer error isolated, other scorers still have valid scores |
| T-9a  | ✅ `completedWithErrors === true`                               |
| T-9b  | ✅ `completedWithErrors === false`                              |
| T-10a | ✅ `skippedCount > 0`, invariant holds                          |
| T-10b | ✅ `skippedCount === 0` on normal completion                    |
| T-11  | ✅ Results in dataset item order                                |

If any existing tests break, check whether they need `completedWithErrors` / `skippedCount` added to their assertions.

---

## Files Modified

| File                              | Change                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/p1-regression.test.ts` | **NEW** — 13 regression tests                                                                                                    |
| `types.ts`                        | Add `maxRetries`, `retryDelay`, `retainResults` to `RunConfig`. Add `completedWithErrors`, `skippedCount` to `RunSummary`.       |
| `index.ts`                        | Retry loop, `isTransientError` helper, pre-allocated results array, `retainResults` gate, `skippedCount`, `completedWithErrors`. |
| `scorer.ts`                       | Parallel scorers via `Promise.allSettled` replacing sequential `for` loop.                                                       |

All paths relative to `packages/core/src/datasets/run/`.

---

## Verification

### Tests

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/
```

All 13 new P1 tests pass. All existing tests (including 5 P0 regression + 31 original) pass unchanged.

### Manual checks

- T-6a: `retainResults: false` → empty results, counters accurate
- T-6b: default → results populated (backward compat)
- T-7a: transient error retried, `retryCount` reflects attempts
- T-7b: no retry by default, agent called once per item
- T-7c: non-retryable error not retried, called exactly once
- T-7d: abort during retry backoff stops further attempts
- T-8a: parallel scorers ≈ 100ms wall clock, not 300ms
- T-8b: scorer error isolated, other scorers unaffected under parallelism
- T-9a: `completedWithErrors === true` when partial failure
- T-9b: `completedWithErrors === false` when all succeed
- T-10a: `skippedCount + succeededCount + failedCount === totalItems` on abort
- T-10b: `skippedCount === 0` on normal completion
- T-11: results in dataset item order regardless of completion order

### Risks

- **Retry exponential backoff with jitter**: `retryDelay * 2^attempt + random(0, retryDelay/2)`. With `maxRetries: 3` and default `retryDelay: 1000`, worst case is ~8.5s extra per item. Acceptable — opt-in only. Jitter prevents thundering herd.
- **`isTransientError` heuristic**: Pattern matching on error strings is fragile. Could miss or misclassify. No structured error types exist in executor output. Explicitly excludes `AbortError`.
- **New `RunSummary` fields**: `completedWithErrors` and `skippedCount` are additive. No breaking change. Server handler (`datasets.ts:585`) runs `runDataset` fire-and-forget, doesn't serialize `RunSummary` — no immediate consumer impact.
- **Parallel scorer persistence order**: Score writes within a single item become non-deterministic. Acceptable — scores are keyed by `scorerId`.
- **Pre-allocated results array**: Same memory footprint as `push`. `retainResults: false` is the actual memory fix.
- **`retainResults: false`**: Callers must rely on storage for results. No `RunSummary.results` data. Type is still `ItemWithScores[]` (empty array), so no type break.

---

## What changed from the previous plan

| Aspect                    | Previous plan                                  | Updated plan                                                                                                                                              |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue 6 (Memory)          | Deferred entirely                              | **Opt-in `retainResults: false`** — escape hatch without breaking API                                                                                     |
| Retry backoff             | Linear: `1000ms * attempt`                     | **Exponential with jitter: `retryDelay * 2^attempt + random(0, retryDelay/2)`** — prevents thundering herd                                                |
| Retry config              | Only `maxRetries`                              | **`maxRetries` + `retryDelay`** — configurable base delay                                                                                                 |
| `isTransientError`        | Excluded `AbortError` implicitly               | **Explicitly checks for `/abort/i` and returns false**                                                                                                    |
| Issue 9 (Status)          | `completedWithErrors: boolean` on `RunSummary` | Same — kept conservative approach (no `RunStatus` enum change)                                                                                            |
| Issue 10 (`skippedCount`) | Computed, not persisted                        | Same — kept lightweight approach (no schema change)                                                                                                       |
| Test count                | 7 tests                                        | **13 tests** — added T-6a/T-6b for `retainResults`, T-7c/T-7d for retry edge cases, T-8b for scorer error isolation, T-10b for normal completion baseline |

---

## Existing test updates expected

- Some existing tests may need `completedWithErrors` and `skippedCount` added to their assertions
- Verify `retryCount` default of `0` matches existing `ItemResult` shape
- Results ordering change (pre-allocated array) should not break existing tests as they don't assert order
