# Streaming Dataset Run Executor — Plan

## Overview

Add `onItemComplete` callback to `runDataset` so callers can consume results as they complete without accumulating them in memory. Smart default: when `onItemComplete` is provided, `retainResults` defaults to `false`.

**Prerequisite**: P0 + P1 fixes merged via PRs #12789, #12797 targeting `feat/datasets`.

**No breaking changes** — this feature has not shipped to customer-facing users yet.

---

## Memory Model

```
WITHOUT onItemComplete (current default):
  item completes → persist to storage → hold in results[] → GC after runDataset returns
  Memory: O(N × result_size) for entire run duration

WITH onItemComplete (new behavior):
  item completes → persist to storage → callback(result) → drop reference → GC immediately
  Memory: O(1) per completed item — only live items in p-map slots
```

When `onItemComplete` is provided: `retainResults` auto-defaults to `false`.
Caller can override with `retainResults: true` if they need both.

---

## Design Decisions

1. **Callback over AsyncGenerator/ReadableStream** — `runDataset` returns `Promise<RunSummary>`. A callback is additive. Callers can build their own stream/EventEmitter on top.

2. **Smart default for `retainResults`** — When `onItemComplete` is provided, `retainResults` defaults to `false`. Explicit `retainResults: true` overrides.

3. **No `onProgress` callback** — Callers compute progress trivially in `onItemComplete` (`count++`). Can be added later.

4. **Callback is awaited** — Enables backpressure: a slow callback holds its p-map concurrency slot.

5. **Callback errors are non-fatal** — Same pattern as `addResult`: catch + `console.warn`.

---

## Interaction Matrix

| `retainResults`  | `onItemComplete` | Behavior                                                          |
| ---------------- | ---------------- | ----------------------------------------------------------------- |
| `true` (default) | not set          | Current behavior — all results in `RunSummary.results`            |
| `true`           | set              | Results in memory + callback fired per item                       |
| auto `false`     | set              | **Zero-memory streaming** — callback gets each item, nothing held |
| `false`          | not set          | Empty `results[]` — must use storage to fetch results             |

---

## Complexity Estimate

- **Size**: Small (3 files modified, 1 new test file)
- **Risk**: Low — purely additive, no changes to return types or existing behavior
- **Dependencies**: None

---

## Requirements

| Feature             | Requirement                                                   | Must Be True                                                                                                                      |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `onItemComplete`    | Callback fires once per completed item                        | Called exactly `items.length` times on normal completion. Both succeeded and failed items. Receives `ItemWithScores` and `index`. |
| Smart default       | `retainResults` defaults to `false` when `onItemComplete` set | Without explicit `retainResults: true`, `RunSummary.results` is empty when callback is provided.                                  |
| Explicit override   | `retainResults: true` + `onItemComplete` gives both           | Results in memory AND callback fires per item.                                                                                    |
| Callback ordering   | Callbacks fire in completion order (not dataset order)        | With concurrent execution, fastest items call back first. `index` reflects original dataset position.                             |
| Callback error      | Callback throw is non-fatal                                   | A throwing callback does not abort the run. Error is caught + warned.                                                             |
| Async callback      | Callback can be async (awaited)                               | `onItemComplete` return value is awaited if it's a Promise.                                                                       |
| Callback on abort   | Callback fires for items completed before abort               | Items that finished before abort trigger the callback. Skipped items do not.                                                      |
| Zero-memory pattern | `onItemComplete` without explicit retain holds no results     | `RunSummary.results === []`. Outputs are GC-eligible after callback returns.                                                      |

---

## Steps

### Step 1 — Add `onItemComplete` to RunConfig

**File**: `packages/core/src/datasets/run/types.ts`

Add after `retryDelay` (line 29):

```typescript
/** Called after each item completes execution, scoring, and persistence.
 *  Callback errors are logged but do not stop the run.
 *  If the callback returns a Promise, it is awaited before proceeding.
 *  When provided, retainResults defaults to false (zero memory accumulation). */
onItemComplete?: (result: ItemWithScores, index: number) => void | Promise<void>;
```

---

### Step 2 — Create regression tests

**File**: `packages/core/src/datasets/run/__tests__/streaming-regression.test.ts` (NEW)

7 test cases:

**T-1: onItemComplete fires for each item**

- 5 items, mock agent
- `onItemComplete` spy
- Assert: spy called 5 times
- Assert: each call receives `ItemWithScores` and correct `index`

**T-2: onItemComplete auto-defaults retainResults to false**

- 5 items, `onItemComplete` collects items (no explicit `retainResults`)
- Assert: `RunSummary.results` is empty (`[]`)
- Assert: callback collected 5 items

**T-3: onItemComplete + explicit retainResults true gives both**

- 3 items, `retainResults: true`, `onItemComplete` spy
- Assert: `RunSummary.results.length === 3`
- Assert: spy called 3 times

**T-4: onItemComplete receives both success and failure items**

- 3 items: 2 succeed, 1 fails
- `onItemComplete` tracks errors
- Assert: callback called 3 times
- Assert: exactly 1 call has `item.error !== null`

**T-5: onItemComplete throw is non-fatal**

- 3 items, `onItemComplete` throws on every call
- Assert: run completes successfully
- Assert: `succeededCount === 3`

**T-6: async onItemComplete is awaited**

- 3 items, `maxConcurrency: 1`
- `onItemComplete` has 50ms delay
- Track call end times
- Assert: callbacks don't overlap (each starts after previous finishes)

**T-7: onItemComplete on abort — only completed items**

- 10 items, `maxConcurrency: 2`
- Mock agent: 200ms per item
- Abort after ~300ms
- `onItemComplete` collects items
- Assert: callback called for completed items only (< 10)

**Checkpoint — verify tests fail:**

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/streaming-regression.test.ts
```

Expected: all 7 tests fail (property doesn't exist on `RunConfig` / callback never invoked).

Do NOT proceed to Step 3 until failures are confirmed.

---

### Step 3 — Implement in runDataset

**File**: `packages/core/src/datasets/run/index.ts`

**3a** — Destructure `onItemComplete` and apply smart default for `retainResults`:

```typescript
const {
  // ... existing fields ...
  onItemComplete,
  retainResults = onItemComplete ? false : true,
  runId: providedRunId,
} = config;
```

Note: `onItemComplete` must be destructured **before** `retainResults` so the default expression can reference it.

**3b** — After the `if (retainResults)` block (line ~223), invoke callback:

```typescript
if (onItemComplete) {
  try {
    await onItemComplete({ ...itemResult, scores: itemScores }, index);
  } catch (callbackError) {
    console.warn(`onItemComplete callback error for item ${item.id}:`, callbackError);
  }
}
```

---

### Step 4 — Server handler optimization

**File**: `packages/server/src/server/handlers/datasets.ts`

The server handler calls `runDataset` fire-and-forget and never reads `RunSummary.results`. Add `retainResults: false`:

```typescript
await runDataset(mastra, {
  // ... existing fields ...
  retainResults: false, // Results fetched via listResults API
});
```

One-line change, no behavioral difference — results are already available via `GET /datasets/:id/runs/:runId/results`.

---

### Step 5 — Run tests and verify

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/streaming-regression.test.ts
cd packages/core && pnpm vitest run src/datasets/run/__tests__/
```

**Checkpoint**: All 7 new tests pass. All existing tests unchanged.

---

## Edge Cases

- **Slow callback** — Holds its p-map concurrency slot. This is correct: enables backpressure. Heavy work should be offloaded to a queue.
- **Callback throws** — Caught + warned. Run continues. Item is already persisted to storage before callback fires.
- **Abort during callback** — Current callback completes (it's already awaited). Next p-map iteration sees abort and skips.
- **Object identity** — Callback receives a fresh copy (`{ ...itemResult, scores }`), not a reference to the internal results array slot. Safe to mutate.

---

## Files Modified

| File                                     | Change                                             |
| ---------------------------------------- | -------------------------------------------------- |
| `types.ts`                               | Add `onItemComplete` to `RunConfig`                |
| `index.ts`                               | Smart default + invoke callback                    |
| `__tests__/streaming-regression.test.ts` | **NEW** — 7 regression tests                       |
| `packages/server/.../datasets.ts`        | Add `retainResults: false` to fire-and-forget call |

All paths relative to `packages/core/src/datasets/run/` unless specified.

---

## Verification

### Tests

```bash
cd packages/core && pnpm vitest run src/datasets/run/__tests__/
```

All new + existing tests pass.

---

## Risks

| Risk                                    | Mitigation                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Slow `onItemComplete` blocks p-map slot | By design — enables backpressure. Document that heavy work should be offloaded to a queue.                   |
| Callback ordering confusion             | Document: callbacks fire in completion order, `index` gives dataset position.                                |
| Smart default surprise                  | If caller expects `results` but passes `onItemComplete`, they get `[]`. Override with `retainResults: true`. |
| Server handler change                   | One-line, no behavioral difference. Results already in storage.                                              |

---

## What This Does NOT Do

- **No `onProgress` callback** — callers compute progress in `onItemComplete` trivially
- **No AsyncGenerator/ReadableStream** — callback is simpler and sufficient
- **No batched storage writes** — separate concern
- **No SSE/WebSocket for server** — follow-up task; callback API makes it possible
