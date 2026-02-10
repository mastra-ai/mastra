# Phase 2 — Core Engine

> Sequential. Single task. The `runExperiment()` function gains inline data + inline task support.

---

## Dependencies

Phase 0 — `expectedOutput` → `groundTruth`, `context` → `metadata`, `outputSchema` → `groundTruthSchema` renames must be complete.
Phase 1b — `DataItem`, `ExperimentConfig` generics, `StartExperimentConfig`, and `experimentId` rename must exist.

---

## Post Phase 0 + Phase 1b state

After Phase 0 + Phase 1b complete, these are the types you will be working with:

### `ExperimentConfig` (after Phase 1b)

```ts
interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  datasetId?: string; // was required, now optional
  targetType?: TargetType; // was required, now optional
  targetId?: string; // was required, now optional
  scorers?: (MastraScorer | string)[];
  version?: Date;
  maxConcurrency?: number; // default 5
  signal?: AbortSignal;
  itemTimeout?: number;
  maxRetries?: number; // default 0
  experimentId?: string; // renamed from runId in Phase 1b
  name?: string; // new in Phase 1b
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>); // new in Phase 1b
  task?: (args: {
    // new in Phase 1b
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;
}
```

### `DataItem` (new in Phase 1b)

```ts
interface DataItem<I = unknown, E = unknown> {
  id?: string;
  input: I;
  groundTruth?: E;
  metadata?: Record<string, unknown>;
}
```

### `DatasetItem` (after Phase 0 rename)

```ts
interface DatasetItem {
  id: string;
  datasetId: string;
  version: Date;
  input: unknown;
  groundTruth?: unknown; // was expectedOutput before Phase 0
  metadata?: Record<string, unknown>; // was context before Phase 0
  createdAt: Date;
  updatedAt: Date;
}
```

### `ItemResult` (after Phase 0 rename)

```ts
interface ItemResult {
  itemId: string;
  itemVersion: Date;
  input: unknown;
  output: unknown | null;
  groundTruth: unknown | null; // was expectedOutput before Phase 0
  latency: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date;
  retryCount: number;
}
```

### `ExperimentSummary` (after Phase 1b rename)

```ts
interface ExperimentSummary {
  experimentId: string; // was runId before Phase 1b
  status: RunStatus;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  completedWithErrors: boolean;
  startedAt: Date;
  completedAt: Date;
  results: ItemWithScores[];
}
```

### `ExecutionResult` (unchanged)

```ts
interface ExecutionResult {
  output: unknown;
  error: string | null;
  traceId: string | null;
  scorerInput?: ScorerRunInputForAgent;
  scorerOutput?: ScorerRunOutputForAgent;
}
```

### `runScorersForItem` full signature (from scorer.ts L38–48)

```ts
async function runScorersForItem(
  scorers: MastraScorer<any, any, any, any>[],
  item: DatasetItem,
  output: unknown,
  storage: MastraCompositeStore | null,
  runId: string,
  targetType: TargetType,
  targetId: string,
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
): Promise<ScorerResult[]>;
```

Note: `runScorersForItem` internally calls `scorer.run({ input, output, groundTruth: item.groundTruth })` (after Phase 0 rename).

---

## Task — Refactor `runExperiment()`

### Files

| File                                             | Changes                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/datasets/experiment/index.ts` | Add item resolution phase, add task resolution phase, replace `executeTarget()` call with `execFn()` in p-map mapper |

### Existing code to reuse

| What                                      | Where                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `runExperiment()`                         | `packages/core/src/datasets/experiment/index.ts` L38–301 — extend in-place             |
| `executeTarget()`                         | `packages/core/src/datasets/experiment/executor.ts` L69 — reuse for registry targets   |
| `resolveScorers()`, `runScorersForItem()` | `packages/core/src/datasets/experiment/scorer.ts` — unchanged                          |
| `resolveTarget()`                         | `packages/core/src/datasets/experiment/index.ts` L307–343 — reuse for registry targets |
| `p-map`                                   | Already a dependency                                                                   |

---

## Current `runExperiment()` structure (before Phase 2 changes, after Phase 0+1b)

```
L38   async function runExperiment(mastra, config) → ExperimentSummary
L39-50  Destructure config — datasetId, targetType, targetId, scorers, version, maxConcurrency, signal, itemTimeout, maxRetries, experimentId
L52-54  startedAt = new Date(); experimentId = providedExperimentId ?? crypto.randomUUID()
L57-63  Get storage: datasetsStore, runsStore. THROWS if datasetsStore missing.
L66-79  Load dataset by ID, load items by version. THROWS if dataset or items not found.
L82-85  resolveTarget(mastra, targetType, targetId). THROWS if target not found.
L88     resolveScorers(mastra, scorerInput)
L91-109 Create run record (if not pre-created). Update status to 'running'.
L111-245 p-map loop (see below)
L246-273 Fatal error catch → partial summary with status: 'failed'
L275-301 Finalize run record, return ExperimentSummary
```

### p-map loop (L124–244) — per-item logic

```
1. Check signal?.aborted → throw AbortError
2. Compose per-item signal (timeout + run-level abort)
3. Retry loop: executeTarget(target, targetType, item, { signal }) — retries up to maxRetries
4. Track succeededCount/failedCount
5. Build ItemResult: { itemId: item.id, itemVersion: item.version, input: item.input, output, groundTruth: item.groundTruth ?? null, latency, error, startedAt, completedAt, retryCount }
6. runScorersForItem(scorers, item, output, storage, experimentId, targetType, targetId, scorerInput, scorerOutput)
7. Persist result via runsStore.addResult() (best-effort)
8. Throttled progress updates via runsStore.updateRun()
9. Store result at results[idx] for deterministic ordering
```

### How p-map loop accesses items (9 field accesses)

| Field access       | Used in                              | Line |
| ------------------ | ------------------------------------ | ---- |
| `item.id`          | ItemResult.itemId                    | L175 |
| `item.version`     | ItemResult.itemVersion               | L176 |
| `item.input`       | ItemResult.input                     | L177 |
| `item.groundTruth` | ItemResult.groundTruth               | L179 |
| `item.id`          | runsStore.addResult({ itemId })      | L205 |
| `item.version`     | runsStore.addResult({ itemVersion }) | L206 |
| `item.input`       | runsStore.addResult({ input })       | L207 |
| `item.groundTruth` | runsStore.addResult({ groundTruth }) | L209 |
| `item.id`          | console.warn message                 | L219 |

The loop also passes the entire `item` to:

- `executeTarget(target, targetType, item, { signal })` at L144/L160
- `runScorersForItem(scorers, item, output, ...)` at L188

`executeTarget()` accesses `item.input` internally.
`runScorersForItem()` accesses `item.input`, `item.groundTruth`, `item.metadata`.

---

## Implementation

The function will be refactored into **2 resolution phases** before the existing p-map loop.

### Phase A — Resolve items (insert BEFORE L66)

```
if config.data:
  - Array → map to DatasetItem-compatible objects:
      {
        id: dataItem.id ?? crypto.randomUUID(),
        datasetId: config.datasetId ?? 'inline',
        version: new Date(),
        input: dataItem.input,
        groundTruth: dataItem.groundTruth,
        metadata: dataItem.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
  - Factory → await factory(), then map like array
  Skip L66–79 entirely (no storage lookup).
else:
  - Use existing datasetId path (L66–79, unchanged)
Validation: at least one of data or datasetId must be provided.
  → throws Error('No data source: provide datasetId or data')
```

Note: `DataItem` and `DatasetItem` now use the same field names (`groundTruth`, `metadata`) after Phase 0 rename. No mapping needed — just copy fields through.

### Phase B — Resolve task function (insert BEFORE L82)

```
if config.task:
  - Create execFn: async (item: DatasetItem, signal?: AbortSignal) => ExecutionResult
  - The wrapper:
      1. Calls config.task({ input: item.input, mastra, groundTruth: item.groundTruth, metadata: item.metadata, signal })
      2. Returns { output: result, error: null, traceId: null }
      3. Catches errors → { output: null, error: message, traceId: null }
  Skip L82–85 entirely (no resolveTarget).
else:
  - Use existing resolveTarget() + executeTarget() path (L82–85)
  - Create execFn: async (item, signal) => executeTarget(target, targetType, item, { signal })
Validation: at least one of task or (targetType + targetId) must be provided.
  → throws Error('No task: provide targetType+targetId or task')
```

### Phase C — Resolve scorers (L88) — UNCHANGED

`resolveScorers(mastra, scorerInput)` — works as-is.

### p-map loop changes

The p-map loop body at L144 currently calls:

```ts
let execResult = await executeTarget(target, targetType, item, { signal: itemSignal });
```

Replace with:

```ts
let execResult = await execFn(item, itemSignal);
```

And the retry loop at L160:

```ts
execResult = await executeTarget(target, targetType, item, { signal: itemSignal });
```

Replace with:

```ts
execResult = await execFn(item, itemSignal);
```

**Everything else in the p-map loop stays identical** — ItemResult building, scorer execution, persistence, progress updates.

### `runScorersForItem` call (L188–198) — special handling

Current call passes `targetType` and `targetId`:

```ts
const itemScores = await runScorersForItem(
  scorers,
  item,
  execResult.output,
  storage ?? null,
  experimentId,
  targetType,
  targetId,
  execResult.scorerInput,
  execResult.scorerOutput,
);
```

Full signature for reference:

```ts
async function runScorersForItem(
  scorers: MastraScorer<any, any, any, any>[],
  item: DatasetItem, // uses item.input, item.groundTruth, item.metadata
  output: unknown,
  storage: MastraCompositeStore | null,
  runId: string, // used for score persistence
  targetType: TargetType, // used for score persistence metadata
  targetId: string, // used for score persistence metadata
  scorerInput?: ScorerRunInputForAgent,
  scorerOutput?: ScorerRunOutputForAgent,
): Promise<ScorerResult[]>;
```

For inline tasks, `targetType` and `targetId` may not exist. Use fallback:

```ts
targetType ?? 'agent'; // or a new 'inline' value
targetId ?? 'inline';
```

Note: `runScorersForItem` passes these to `validateAndSaveScore()` for score persistence metadata. For inline tasks, these values are only cosmetic labels in score records.

### Run record creation (L91–109) — conditional

When using inline data without a dataset, `datasetId` may be `'inline'`. The run record will still be created with this synthetic ID. This is acceptable since all experiments run through `Dataset.startExperiment()` which always has a real `datasetId`.

---

## Backward compatibility

- All new fields (`data`, `task`, `name`) are optional
- Existing internal `{ datasetId, targetType, targetId, scorers }` calls work unchanged — they hit the `else` branches of both resolution phases
- `experimentId` replaces `runId` (Phase 1b rename) — the destructure uses the new field name
- The only required invariant: must provide at least one data source and one task source
- `runExperiment()` is internal — callers always go through `Dataset.startExperiment()` which injects `datasetId` and `mastra`

---

## Tests

### File

`packages/core/src/datasets/experiment/__tests__/runExperiment.test.ts` — extend existing file.

### Mock patterns (from existing tests, L1–91)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MastraScorer } from '../../../evals/base';
import type { Mastra } from '../../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../../storage/base';
import { DatasetsInMemory } from '../../../storage/domains/datasets/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { RunsInMemory } from '../../../storage/domains/runs/inmemory';
import { runExperiment } from '../index';
```

**Mock Mastra**: Plain object with `vi.fn()` methods:

```ts
mastra = {
  getStorage: vi.fn().mockReturnValue(mockStorage),
  getAgent: vi.fn().mockReturnValue(mockAgent),
  getAgentById: vi.fn().mockReturnValue(mockAgent),
  getScorerById: vi.fn(),
  getWorkflowById: vi.fn(),
  getWorkflow: vi.fn(),
} as unknown as Mastra;
```

**Mock storage**: Uses real `InMemoryDB` + `DatasetsInMemory` + `RunsInMemory`:

```ts
db = new InMemoryDB();
datasetsStorage = new DatasetsInMemory({ db });
runsStorage = new RunsInMemory({ db });
mockStorage = {
  id: 'test-storage',
  stores: { datasets: datasetsStorage, runs: runsStorage } as unknown as StorageDomains,
  getStore: vi.fn().mockImplementation(async name => {
    if (name === 'datasets') return datasetsStorage;
    if (name === 'runs') return runsStorage;
    return undefined;
  }),
} as unknown as MastraCompositeStore;
```

**Mock agent**: `createMockAgent(response, shouldFail?)` — returns object with `id`, `name`, `getModel`, `generate` mocks.

**Mock scorer**: `createMockScorer(id, name)` — returns object with `id`, `name`, `description`, `run` mock.

### New describe block: `inline data + inline task`

Add a NEW describe block in the existing test file. Do NOT modify existing tests.

### Test 1 — Inline data array (no storage fetch)

**Setup**: Call `runExperiment` with `data: [{ input: ..., groundTruth: ... }, ...]` and existing registry target.
**Assert**:

- `summary.totalItems === data.length`
- `summary.succeededCount === data.length`
- `summary.status === 'completed'`
- Each result has correct `input` matching the inline data
- `datasetsStorage.getDatasetById` was NOT called (verify via spy or by not seeding a dataset)
- Items have auto-generated `id` (UUID format)

**Key detail**: `datasetId` should still be provided (injected by `Dataset`) for the run record. The `data` field only overrides the items source, not the dataset association.

### Test 2 — Inline data factory function

**Setup**: Call `runExperiment` with `data: async () => [{ input: 'from-factory' }]` and existing registry target.
**Assert**:

- Factory was called
- `summary.totalItems === 1`
- `results[0].input` matches factory output
- Storage item fetch was NOT called

### Test 3 — Inline task function

**Setup**: Call `runExperiment` with `datasetId` (storage-backed items) and `task: async ({ input }) => 'processed-' + input.prompt`.
**Assert**:

- `summary.status === 'completed'`
- Each result's `output === 'processed-' + item.input.prompt`
- `resolveTarget` was NOT called (no `targetType`/`targetId` needed — verify by not mocking `getAgentById`)
- `traceId` is `null` (inline tasks don't generate traces)

### Test 4 — Inline task receives all arguments

**Setup**: Create dataset items with `groundTruth` and `metadata` fields. Call with inline `task` that captures its arguments.
**Assert**:

- Task was called with `{ input: item.input, mastra: <the mastra instance>, groundTruth: item.groundTruth, metadata: item.metadata, signal: <AbortSignal> }`
- Verify `mastra` is the same instance passed to `runExperiment`

### Test 5 — Inline data + inline task (full inline experiment)

**Setup**: Call `runExperiment` with both `data: [...]` and `task: async ({ input }) => ...`. No `targetType`, no `targetId`.
**Assert**:

- `summary.status === 'completed'`
- Items came from inline data, execution used inline task
- Results have correct input/output pairing

**Key detail**: `datasetId` should still be provided for run record association. When no `datasetId` is provided, the run record creation at L91–109 must handle `datasetId` being undefined/empty. Use `datasetId: 'inline'` or similar synthetic value.

### Test 6 — Inline task returns sync value

**Setup**: Call with inline `task: ({ input }) => 'sync-' + input.prompt` (no `async`, no `await`).
**Assert**:

- Works correctly — the `O | Promise<O>` contract is honored
- `summary.status === 'completed'`
- Output matches sync return value

### Test 7 — Inline task error isolation

**Setup**: Call with inline `task` that throws for one specific input and succeeds for others.
**Assert**:

- Failed item has `output: null`, `error: <message>`
- Other items have `output: <value>`, `error: null`
- `summary.completedWithErrors === true`
- `summary.failedCount === 1`

### Test 8 — No data source → throws

**Setup**: Call `runExperiment` with `task: fn` but NO `datasetId` and NO `data`.
**Assert**:

- Throws `Error('No data source: provide datasetId or data')`

### Test 9 — No task source → throws

**Setup**: Call `runExperiment` with `datasetId` but NO `targetType`/`targetId` and NO `task`.
**Assert**:

- Throws `Error('No task: provide targetType+targetId or task')`

### Test 10 — Backward compatibility (existing config shape)

**Setup**: Call `runExperiment` with the exact same config shape used in existing tests: `{ datasetId, targetType: 'agent', targetId: 'test-agent', scorers }`.
**Assert**:

- Works identically to existing tests
- `summary.status === 'completed'`
- This test exists to catch regressions in the refactor

### Test 11 — `experimentId` field works

**Setup**: Call `runExperiment` with `experimentId: 'pre-created-id'` plus valid data/task.
**Assert**:

- `summary.experimentId === 'pre-created-id'`
- Run record was NOT created via `runsStore.createRun()` (only `updateRun` called)

### Test 12 — Inline data + scorers verify groundTruth pipeline

**Setup**: Call `runExperiment` with:

- `data: [{ input: { q: 'hello' }, groundTruth: 'expected-answer' }]`
- `task: async ({ input }) => 'some-output'`
- `scorers: [mockScorer]`

**Assert**:

- `mockScorer.run` was called with `{ input: { q: 'hello' }, output: 'some-output', groundTruth: 'expected-answer' }`
- Verifies the full pipeline: `DataItem.groundTruth` → `DatasetItem.groundTruth` → scorer `groundTruth` arg

---

## Completion Criteria

- [ ] `runExperiment(mastra, { datasetId, targetType, targetId, scorers })` still works (backward compat) — **Test 10**
- [ ] `runExperiment(mastra, { data: [...], task: fn, scorers })` works (inline path) — **Test 5**
- [ ] `runExperiment(mastra, { data: async () => [...], task: fn, scorers })` works (factory path) — **Test 2**
- [ ] Inline task receives `{ input, mastra, groundTruth, metadata, signal }` — **Test 4**
- [ ] Sync task return value works (`O | Promise<O>`) — **Test 6**
- [ ] Missing data source → throws `Error('No data source: provide datasetId or data')` — **Test 8**
- [ ] Missing task source → throws `Error('No task: provide targetType+targetId or task')` — **Test 9**
- [ ] Task error for one item does not fail entire experiment — **Test 7**
- [ ] Scorer error for one scorer does not affect other scorers — covered by existing tests (scoring describe block)
- [ ] `experimentId` field works — **Test 11**
- [ ] Inline data + scorer receives correct `groundTruth` — **Test 12**
- [ ] All 4 existing test files pass unchanged: `runExperiment.test.ts`, `p0-regression.test.ts`, `p1-regression.test.ts`, `executor.test.ts`
- [ ] `pnpm build:core` passes
