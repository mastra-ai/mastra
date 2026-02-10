# Phase 5 — Tests

> Parallel: **5a ‖ 5b ‖ 5c**. Three test files. Can also run in parallel with Phase 6 (server migration).

---

## Dependencies

Phase 4 — barrel exports, Mastra getter, and root re-exports must be in place.

Phase 0 — renames (`expectedOutput` → `groundTruth`, `context` → `metadata`, `outputSchema` → `groundTruthSchema`) are complete.
Phase 1 — `DatasetRecord` rename and `DataItem`/`ExperimentConfig` generics exist.
Phase 2 — `runExperiment()` supports inline data + inline task.
Phase 3 — `Dataset` and `DatasetsManager` classes exist.
Phase 4 — barrel exports, `mastra.datasets` getter, root re-exports wired.

---

## Post Phase 0–4 type shapes

After all prerequisites, these types are in effect. Tests MUST use these names, not the old ones.

### Storage types (`packages/core/src/storage/types.ts`)

```ts
// Renamed from `Dataset` in Phase 1a
interface DatasetRecord {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>; // was outputSchema
  version: Date;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetItem {
  id: string;
  datasetId: string;
  version: Date;
  input: unknown;
  groundTruth?: unknown; // was expectedOutput
  metadata?: Record<string, unknown>; // was context
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetItemVersion {
  id: string;
  itemId: string;
  datasetId: string;
  versionNumber: number;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  isDeleted: boolean;
  createdAt: Date;
}

// Run types — storage layer still uses `runId`, NOT `experimentId`
interface Run {
  id: string; // maps to `experimentId` in public API
  datasetId: string;
  status: string;
  // ...
}

interface RunResult {
  id: string;
  runId: string; // storage uses `runId`, not `experimentId`
  itemId: string;
  input: unknown;
  output: unknown;
  groundTruth: unknown; // was expectedOutput
  traceId: string | null;
  // ...
}

interface ListRunResultsInput {
  runId: string; // storage uses `runId`, not `experimentId`
  pagination: StoragePagination;
}
```

### Experiment types (`packages/core/src/datasets/experiment/types.ts`)

```ts
interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  datasetId?: string;
  targetType?: string;
  targetId?: string;
  experimentId?: string; // was runId
  name?: string;
  scorers?: (MastraScorer | string)[];
  maxConcurrency?: number;
  itemTimeout?: number;
  maxRetries?: number;
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>);
  task?: (args: {
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;
}

interface DataItem<I = unknown, E = unknown> {
  id?: string;
  input: I;
  groundTruth?: E;
  metadata?: Record<string, unknown>;
}

type StartExperimentConfig<I = unknown, O = unknown, E = unknown> = Omit<
  ExperimentConfig<I, O, E>,
  'datasetId' | 'data' | 'experimentId'
>;

interface ExperimentSummary {
  experimentId: string; // was runId
  status: string;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  results: ItemWithScores[];
  // ...
}
```

### Validation errors (`packages/core/src/datasets/validation/errors.ts`)

```ts
// After Phase 0, field type changes from 'expectedOutput' to 'groundTruth'
class SchemaValidationError extends Error {
  readonly field: 'input' | 'groundTruth'; // was 'expectedOutput'
  readonly errors: FieldError[];
}

class SchemaUpdateValidationError extends Error {
  readonly failingItems: Array<{
    field: 'input' | 'groundTruth'; // was 'expectedOutput'
    errors: FieldError[];
  }>;
}
```

### MastraError (`packages/core/src/error/index.ts`)

```ts
class MastraError extends MastraBaseError<`${ErrorDomain}`, `${ErrorCategory}`> {}

// Constructor:
new MastraError({
  id: 'DATASETS_STORAGE_NOT_CONFIGURED', // Uppercase<string>, REQUIRED
  text: 'Storage not configured. ...', // NOT `message`
  domain: 'STORAGE', // ErrorDomain enum value
  category: 'USER', // ErrorCategory enum value
});

// Public fields for assertions:
err.id; // Uppercase<string>
err.domain; // string
err.category; // string
err.message; // string (derived from `text`)
```

### Storage domain methods (exact signatures)

```ts
// DatasetsStorage
abstract createDataset(input: CreateDatasetInput): Promise<DatasetRecord>;
abstract getDatasetById(args: { id: string }): Promise<DatasetRecord | null>;
abstract listDatasets(args: { pagination: StoragePagination }): Promise<ListDatasetsOutput>;
abstract deleteDataset(args: { id: string }): Promise<void>;
async updateDataset(input: UpdateDatasetInput): Promise<DatasetRecord>;  // concrete, validates
async addItem(input: AddDatasetItemInput): Promise<DatasetItem>;         // concrete, validates
async updateItem(input: UpdateDatasetItemInput): Promise<DatasetItem>;   // concrete, validates
async deleteItem(input: { id: string; datasetId: string }): Promise<void>; // concrete, versions
abstract getItemById(args: { id: string }): Promise<DatasetItem | null>;
abstract listItems(args: { datasetId: string; pagination: StoragePagination }): Promise<ListItemsOutput>;
abstract bulkAddItems(input: BulkAddItemsInput): Promise<DatasetItem[]>;
abstract bulkDeleteItems(input: BulkDeleteItemsInput): Promise<void>;
abstract listDatasetVersions(args: { datasetId: string; pagination: StoragePagination }): Promise<ListDatasetVersionsOutput>;
abstract getItemsByVersion(args: { datasetId: string; version: Date }): Promise<DatasetItemVersion[]>;
abstract getItemVersion(itemId: string, versionNumber?: number): Promise<DatasetItemVersion | null>;  // POSITIONAL args!
abstract listItemVersions(args: { itemId: string; pagination: StoragePagination }): Promise<ListItemVersionsOutput>;

// RunsStorage
abstract createRun(input: CreateRunInput): Promise<Run>;
abstract updateRun(input: UpdateRunInput): Promise<Run>;
abstract getRunById(args: { id: string }): Promise<Run | null>;
abstract listRuns(args: ListRunsInput): Promise<ListRunsOutput>;       // ListRunsInput = { datasetId?, pagination }
abstract deleteRun(args: { id: string }): Promise<void>;
abstract addResult(input: AddRunResultInput): Promise<RunResult>;
abstract listResults(args: ListRunResultsInput): Promise<ListRunResultsOutput>;  // { runId, pagination }
abstract deleteResultsByRunId(args: { runId: string }): Promise<void>;
```

### `compareExperiments` internal (wrapped by `DatasetsManager`)

```ts
// packages/core/src/datasets/experiment/analytics/compare.ts
export async function compareExperiments(mastra: Mastra, config: CompareExperimentsConfig): Promise<ComparisonResult>;

// CompareExperimentsConfig: { runIdA: string, runIdB: string, thresholds?: ScorerThreshold[] }
// ComparisonResult: { runA, runB, versionMismatch, hasRegression, scorers, items, warnings }
// ItemComparison: { itemId, inBothRuns, scoresA, scoresB }  — NO input, groundTruth, or output
// DatasetsManager.compareExperiments() wraps this + loads run results to add input/groundTruth/output
```

---

## Shared test setup

All three test files use the same in-memory storage setup. Each file should replicate this (no shared utility file exists).

### Imports

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore, StorageDomains } from '../../storage/base';
import { DatasetsInMemory } from '../../storage/domains/datasets/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { RunsInMemory } from '../../storage/domains/runs/inmemory';
import { MastraError } from '../../error';
```

### Mastra mock pattern (from existing tests)

```ts
const db = new InMemoryDB();
const datasetsStorage = new DatasetsInMemory({ db });
const runsStorage = new RunsInMemory({ db });

const mockStorage = {
  id: 'test-storage',
  stores: { datasets: datasetsStorage, runs: runsStorage } as unknown as StorageDomains,
  getStore: vi.fn().mockImplementation(async (name: keyof StorageDomains) => {
    if (name === 'datasets') return datasetsStorage;
    if (name === 'runs') return runsStorage;
    return undefined;
  }),
} as unknown as MastraCompositeStore;

const mastra = {
  getStorage: vi.fn().mockReturnValue(mockStorage),
  getAgent: vi.fn(),
  getAgentById: vi.fn(),
  getScorerById: vi.fn(),
  getWorkflowById: vi.fn(),
  getWorkflow: vi.fn(),
} as unknown as Mastra;
```

### No-storage Mastra mock

```ts
const noStorageMastra = {
  getStorage: vi.fn().mockReturnValue(undefined),
  getAgent: vi.fn(),
  getAgentById: vi.fn(),
  getScorerById: vi.fn(),
  getWorkflowById: vi.fn(),
  getWorkflow: vi.fn(),
} as unknown as Mastra;
```

### MastraError assertion pattern

No existing tests assert on `MastraError`. Use this pattern:

```ts
try {
  await mgr.list({});
  expect.fail('Should have thrown');
} catch (err) {
  expect(err).toBeInstanceOf(MastraError);
  const mastraErr = err as MastraError;
  expect(mastraErr.id).toBe('DATASETS_STORAGE_NOT_CONFIGURED');
  expect(mastraErr.domain).toBe('STORAGE');
  expect(mastraErr.category).toBe('USER');
}
```

Or with `expect().rejects`:

```ts
await expect(mgr.list({})).rejects.toThrow(MastraError);
// Then catch to assert fields:
await expect(mgr.list({})).rejects.toMatchObject({
  id: 'DATASETS_STORAGE_NOT_CONFIGURED',
  domain: 'STORAGE',
  category: 'USER',
});
```

### Mock scorer (from existing tests)

```ts
import type { MastraScorer } from '../../evals/base';

const createMockScorer = (scorerId: string, scorerName: string): MastraScorer<any, any, any, any> => ({
  id: scorerId,
  name: scorerName,
  description: 'Mock scorer',
  run: vi.fn().mockImplementation(async ({ output }) => ({
    score: output ? 1.0 : 0.0,
    reason: output ? 'Has output' : 'No output',
  })),
});
```

### Mock agent (from existing tests)

```ts
const createMockAgent = (response: string, shouldFail = false) => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => {
    if (shouldFail) throw new Error('Agent error');
    return { text: response };
  }),
});
```

---

## Task 5a — `manager.test.ts`

### Files

| File                                                   | Changes |
| ------------------------------------------------------ | ------- |
| `packages/core/src/datasets/__tests__/manager.test.ts` | **NEW** |

### Additional imports

```ts
import { DatasetsManager } from '../manager';
import { Dataset } from '../dataset';
import { z } from 'zod';
```

### Test plan

#### 1. Construction — no eager storage access

**Setup**: `new DatasetsManager(mastra)` where `mastra.getStorage` is a spy.
**Assert**:

- `mastra.getStorage` was NOT called during construction
- No error thrown

#### 2. MastraError on missing storage

**Setup**: `new DatasetsManager(noStorageMastra)`.
**Assert**:

- `mgr.create({ name: 'test' })` throws `MastraError`
- `err.id === 'DATASETS_STORAGE_NOT_CONFIGURED'`
- `err.domain === 'STORAGE'`
- `err.category === 'USER'`

#### 3. create — returns Dataset instance with `.id`

**Setup**: `mgr.create({ name: 'test-ds' })`
**Assert**:

- Returns instance of `Dataset`
- `.id` is a non-empty string
- Storage `createDataset` was called with `{ name: 'test-ds' }`

#### 4. create — Zod schema conversion

**Setup**: `mgr.create({ name: 'test', inputSchema: z.object({ q: z.string() }), groundTruthSchema: z.object({ a: z.string() }) })`
**Assert**:

- Returned `Dataset` instance
- Storage `createDataset` was called with JSON Schema objects (not Zod), verifiable by checking the stored dataset's `inputSchema` and `groundTruthSchema` are plain objects with `type: 'object'` and `properties`

#### 5. get — returns Dataset instance

**Setup**: Create a dataset, then `mgr.get({ id: dataset.id })`
**Assert**:

- Returns instance of `Dataset`
- `.id === dataset.id`

#### 6. get — throws on not found

**Setup**: `mgr.get({ id: 'nonexistent' })`
**Assert**:

- Throws `MastraError`
- `err.id === 'DATASET_NOT_FOUND'`
- `err.domain === 'STORAGE'`
- `err.category === 'USER'`

#### 7. list — returns datasets and pagination

**Setup**: Create 2 datasets, then `mgr.list({})`
**Assert**:

- Returns `{ datasets, pagination }`
- `datasets` has length 2
- `pagination` exists

#### 8. list — empty result

**Setup**: `mgr.list({})` with no datasets created
**Assert**:

- `datasets` is empty array
- No error thrown

#### 9. delete — delegates to storage

**Setup**: Create a dataset, then `mgr.delete({ id: dataset.id })`
**Assert**:

- No error thrown
- `mgr.get({ id: dataset.id })` throws `MastraError` (dataset is gone)

#### 10. getExperiment — returns null for missing

**Setup**: `mgr.getExperiment({ experimentId: 'nonexistent' })`
**Assert**:

- Returns `null`
- Storage `getRunById({ id: 'nonexistent' })` was called

#### 11. compareExperiments — validates experimentIds length

**Setup**: `mgr.compareExperiments({ experimentIds: ['only-one'] })`
**Assert**:

- Throws `MastraError`
- Error message indicates at least 2 required

#### 12. compareExperiments — MVP output shape

**Setup**:

1. Create a dataset with 2 items (with `groundTruth`)
2. Run 2 experiments against it (via `runExperiment()` or direct storage manipulation)
3. Call `mgr.compareExperiments({ experimentIds: [expA, expB] })`

**Assert**:

- Returns `{ baselineId, items }`
- `baselineId` defaults to first experiment ID (`expA`)
- Each item has `itemId`, `input`, `groundTruth`
- Each item has `results` keyed by experiment IDs
- `results[expA]` and `results[expB]` each have `output` and `scores`

#### 13. compareExperiments — explicit baselineId

**Setup**: Same as 12 but with `baselineId: expB`
**Assert**:

- `result.baselineId === expB`

#### 14. Lazy resolution caching

**Setup**: Call `mgr.create()` then `mgr.list()` — two calls
**Assert**:

- `mockStorage.getStore` was called only once for `'datasets'` (cached after first call)

#### 15. mastra.datasets — singleton

> NOTE: This overlaps with Phase 4 tests. Include here for completeness but can be skipped if Phase 4 already covers it.

**Setup**: Access `mastra.datasets` twice (requires a real or near-real `Mastra` instance with the getter)
**Assert**:

- Same instance returned both times (`===`)

### Completion Criteria

- [ ] All 15 tests pass via `pnpm test:core`
- [ ] `MastraError` assertions verify `id`, `domain`, and `category` fields
- [ ] Zod conversion tested with both `inputSchema` and `groundTruthSchema`
- [ ] `compareExperiments` output verified with `input`, `groundTruth`, per-experiment `output` + `scores`

---

## Task 5b — `dataset.test.ts`

### Files

| File                                                   | Changes |
| ------------------------------------------------------ | ------- |
| `packages/core/src/datasets/__tests__/dataset.test.ts` | **NEW** |

### Additional imports

```ts
import { Dataset } from '../dataset';
import { SchemaValidationError, SchemaUpdateValidationError } from '../validation/errors';
import { z } from 'zod';
```

### Test plan

#### 1. Construction — no eager storage access

**Setup**: `new Dataset('test-id', mastra)` where `mockStorage.getStore` is a spy.
**Assert**:

- `mockStorage.getStore` NOT called
- `.id === 'test-id'`

#### 2. MastraError on missing storage

**Setup**: `new Dataset('test-id', noStorageMastra)`
**Assert**:

- `ds.getDetails()` throws `MastraError`
- `err.id === 'DATASETS_STORAGE_NOT_CONFIGURED'`
- `err.domain === 'STORAGE'`
- `err.category === 'USER'`

#### 3. Lazy storage — caches after first resolve

**Setup**: Call `ds.getDetails()` twice on the same `Dataset` instance.
**Assert**:

- `mockStorage.getStore('datasets')` called only once (cached)

#### 4. getDetails — returns DatasetRecord

**Setup**: Create dataset via storage, then `new Dataset(id, mastra).getDetails()`
**Assert**:

- Returns object with `id`, `name`, `groundTruthSchema` (not `outputSchema`)

#### 5. getDetails — throws on nonexistent

**Setup**: `new Dataset('nonexistent', mastra).getDetails()`
**Assert**:

- Throws `MastraError`

#### 6. update — delegates with renamed fields

**Setup**: Create dataset, then `ds.update({ description: 'updated' })`
**Assert**:

- Returns updated `DatasetRecord`
- `description === 'updated'`

#### 7. update — Zod schema conversion

**Setup**: `ds.update({ inputSchema: z.object({ q: z.string() }) })`
**Assert**:

- Stored dataset's `inputSchema` is a plain JSON Schema object (not Zod)
- Has `type: 'object'` and `properties.q`

#### 8. addItem — with groundTruth and metadata

**Setup**: `ds.addItem({ input: { q: 'test' }, groundTruth: 'answer', metadata: { source: 'manual' } })`
**Assert**:

- Returns `DatasetItem` with `groundTruth === 'answer'`
- Has `metadata === { source: 'manual' }`
- Has `datasetId === ds.id`

#### 9. addItems — bulk create

**Setup**: `ds.addItems({ items: [{ input: { q: 'a' } }, { input: { q: 'b' }, groundTruth: 'B' }] })`
**Assert**:

- Returns array of 2 `DatasetItem`s
- Both have `datasetId === ds.id`

#### 10. getItem — without version returns DatasetItem

**Setup**: Add an item, then `ds.getItem({ itemId: item.id })`
**Assert**:

- Returns `DatasetItem` with matching `id`
- Has `input`, `groundTruth` fields

#### 11. getItem — with version returns DatasetItemVersion

**Setup**: Add an item, then `ds.getItem({ itemId: item.id, version: 1 })`
**Assert**:

- Returns `DatasetItemVersion` with `versionNumber === 1`
- Calls `store.getItemVersion(item.id, 1)` — **positional args**, not object

#### 12. getItem — nonexistent returns null

**Setup**: `ds.getItem({ itemId: 'nonexistent' })`
**Assert**:

- Returns `null`

#### 13. listItems — without version returns paginated list

**Setup**: Add 3 items, then `ds.listItems({})`
**Assert**:

- Returns `{ items, pagination }` structure
- `items.length === 3`

#### 14. listItems — with version returns snapshot

**Setup**: Add items, get dataset version, then `ds.listItems({ version: datasetVersion })`
**Assert**:

- Returns items as `DatasetItemVersion[]` (snapshot)
- Calls `store.getItemsByVersion({ datasetId, version })`

#### 15. updateItem — returns updated item

**Setup**: Add item, then `ds.updateItem({ itemId: item.id, groundTruth: 'updated' })`
**Assert**:

- Returns `DatasetItem` with `groundTruth === 'updated'`

#### 16. deleteItem — removes item

**Setup**: Add item, then `ds.deleteItem({ itemId: item.id })`
**Assert**:

- `ds.getItem({ itemId: item.id })` returns `null`

#### 17. deleteItems — bulk delete

**Setup**: Add 3 items, then `ds.deleteItems({ itemIds: [item1.id, item2.id] })`
**Assert**:

- `item1` and `item2` are gone
- `item3` still exists

#### 18. listVersions — returns version history

**Setup**: Add/update items to create versions, then `ds.listVersions({})`
**Assert**:

- Returns `{ versions, pagination }`
- Has multiple version entries

#### 19. listItemVersions — returns item version history

**Setup**: Add an item, update it, then `ds.listItemVersions({ itemId: item.id })`
**Assert**:

- Returns `{ versions, pagination }`
- Has 2+ version entries (original + update)

#### 20. startExperiment — injects datasetId and awaits

**Setup**: Create dataset with items, create a mock scorer, then:

```ts
const result = await ds.startExperiment({
  task: async ({ input }) => 'output',
  scorers: [mockScorer],
});
```

**Assert**:

- `result.experimentId` is a non-empty string
- `result.status === 'completed'`
- `result.totalItems` matches item count
- Internal `runExperiment` was called with `datasetId: ds.id`

#### 21. startExperiment — inline task receives mastra

**Setup**:

```ts
let capturedMastra: unknown;
await ds.startExperiment({
  task: async ({ input, mastra: m }) => {
    capturedMastra = m;
    return 'ok';
  },
  scorers: [],
});
```

**Assert**:

- `capturedMastra` is the same `mastra` instance used to create the `Dataset`

#### 22. startExperimentAsync — returns pending immediately

**Setup**: Create dataset with items, then:

```ts
const { experimentId, status } = await ds.startExperimentAsync({
  task: async ({ input }) => 'output',
  scorers: [mockScorer],
});
```

**Assert**:

- `experimentId` is a non-empty string
- `status === 'pending'`
- Run record exists in storage (`runsStorage.getRunById({ id: experimentId })` returns non-null)

#### 23. listExperiments — returns runs for this dataset

**Setup**: Run an experiment, then `ds.listExperiments({})`
**Assert**:

- Returns `{ runs, pagination }`
- Runs include the experiment

#### 24. getExperiment — returns run

**Setup**: Run an experiment, then `ds.getExperiment({ experimentId })`
**Assert**:

- Returns `Run` with `id === experimentId`

#### 25. listExperimentResults — translates experimentId to runId

**Setup**: Run an experiment with results, then `ds.listExperimentResults({ experimentId })`
**Assert**:

- Returns `{ results, pagination }`
- Storage was called with `{ runId: experimentId, pagination }` (not `experimentId` key)

#### 26. deleteExperiment — delegates with correct id

**Setup**: Run experiment, then `ds.deleteExperiment({ experimentId })`
**Assert**:

- No error thrown
- `ds.getExperiment({ experimentId })` returns `null`
- Storage was called with `deleteRun({ id: experimentId })`

#### 27. Stale dataset — operations throw after deletion

**Setup**: Create dataset via manager, get `Dataset` instance, delete via manager, then `ds.getDetails()`
**Assert**:

- Throws (from storage layer, not `MastraError` — exact error depends on storage implementation)

#### 28. SchemaValidationError — invalid input

**Setup**: Create dataset with `inputSchema: z.object({ q: z.string() })` (or JSON Schema equivalent), then:

```ts
await ds.addItem({ input: { q: 123 } }); // invalid type
```

**Assert**:

- Throws `SchemaValidationError`
- `err.field === 'input'`
- `err.errors` has at least one entry

#### 29. SchemaValidationError — invalid groundTruth

**Setup**: Create dataset with `groundTruthSchema: z.object({ a: z.string() })`, then:

```ts
await ds.addItem({ input: { q: 'test' }, groundTruth: { a: 123 } });
```

**Assert**:

- Throws `SchemaValidationError`
- `err.field === 'groundTruth'` (NOT `'expectedOutput'`)

#### 30. SchemaUpdateValidationError — schema breaks existing items

**Setup**: Create dataset, add items, then try to update with an incompatible schema
**Assert**:

- Throws `SchemaUpdateValidationError`
- `err.failingItems` has entries
- Each entry's `field` is `'input'` or `'groundTruth'` (NOT `'expectedOutput'`)

#### 31. Pagination forwarding

**Setup**: Add 5 items, then `ds.listItems({ page: 0, perPage: 2 })`
**Assert**:

- Returns exactly 2 items
- Pagination info reflects total count

### Completion Criteria

- [ ] All 31 tests pass via `pnpm test:core`
- [ ] `SchemaValidationError.field` asserted as `'groundTruth'` (NOT `'expectedOutput'`)
- [ ] `SchemaUpdateValidationError.failingItems[].field` asserted as `'groundTruth'` (NOT `'expectedOutput'`)
- [ ] `getItem({ itemId, version })` verified to call `store.getItemVersion(itemId, version)` with **positional** args
- [ ] `listExperimentResults({ experimentId })` verified to pass `{ runId: experimentId }` to storage
- [ ] `deleteExperiment({ experimentId })` verified to pass `{ id: experimentId }` to storage
- [ ] `startExperimentAsync` verified to return `{ experimentId, status: 'pending' }` before experiment completes

---

## Task 5c — `experiment.test.ts`

### Files

| File                                                      | Changes |
| --------------------------------------------------------- | ------- |
| `packages/core/src/datasets/__tests__/experiment.test.ts` | **NEW** |

### Purpose

Tests the NEW features of `runExperiment()` (Phase 2) exercised through the `Dataset` class (Phase 3). These tests complement the existing 4 test files in `experiment/__tests__/` which cover the original registry-based execution path.

Existing tests already cover: registry target execution, scoring, error isolation (task + scorer), cancellation/abort, concurrency/ordering, retry logic, progress updates. **Do NOT duplicate those.**

### Additional imports

```ts
import { Dataset } from '../dataset';
import { DatasetsManager } from '../manager';
import type { MastraScorer } from '../../evals/base';
```

### Test plan

#### 1. Inline task via dataset — basic

**Setup**: Create dataset with items, then:

```ts
const result = await ds.startExperiment({
  task: async ({ input }) => 'processed-' + (input as any).prompt,
  scorers: [mockScorer],
});
```

**Assert**:

- `result.status === 'completed'`
- `result.totalItems` matches item count
- `result.results` have correct `output` values
- `result.experimentId` is a non-empty string

#### 2. Inline task with generic type params

**Setup**:

```ts
interface QA {
  prompt: string;
}
interface Answer {
  text: string;
}

const result = await ds.startExperiment<QA, Answer>({
  task: async ({ input }) => ({ text: 'answer to ' + input.prompt }),
  scorers: [mockScorer],
});
```

**Assert**:

- Compiles without type errors (TypeScript verification)
- `result.status === 'completed'`
- Output matches expected shape

#### 3. Inline task receives mastra argument

**Setup**: Capture `mastra` from inside the task:

```ts
let capturedMastra: unknown;
await ds.startExperiment({
  task: async ({ input, mastra: m }) => {
    capturedMastra = m;
    return 'ok';
  },
  scorers: [],
});
```

**Assert**:

- `capturedMastra === mastra` (same instance)

#### 4. Inline task receives groundTruth, metadata, signal

**Setup**: Create items with `groundTruth` and `metadata`, capture args:

```ts
let capturedArgs: Record<string, unknown>[] = [];
await ds.startExperiment({
  task: async args => {
    capturedArgs.push(args);
    return 'ok';
  },
  scorers: [],
});
```

**Assert**:

- Each captured arg has `input`, `mastra`, `groundTruth`, `metadata`, `signal`
- `groundTruth` matches item's `groundTruth`
- `metadata` matches item's `metadata`
- `signal` is an `AbortSignal`

#### 5. Inline task returns synchronous value

**Setup**:

```ts
const result = await ds.startExperiment({
  task: ({ input }) => 'sync-' + (input as any).prompt, // no async
  scorers: [],
});
```

**Assert**:

- `result.status === 'completed'`
- Output matches sync return values

#### 6. Scorer receives groundTruth from dataset items

**Setup**: Create items with `groundTruth`, use a spy scorer:

```ts
const spyScorer = createMockScorer('spy', 'spy');
await ds.startExperiment({
  task: async ({ input }) => 'output',
  scorers: [spyScorer],
});
```

**Assert**:

- `spyScorer.run` was called
- Each call received `{ input: <item input>, output: 'output', groundTruth: <item groundTruth> }`
- **NOT** `expectedOutput` — verifies full Phase 0 pipeline

#### 7. Task error isolation — one item fails, others succeed

**Setup**: Create 3 items, inline task throws for one:

```ts
await ds.startExperiment({
  task: async ({ input }) => {
    if ((input as any).prompt === 'fail') throw new Error('boom');
    return 'ok';
  },
  scorers: [],
});
```

**Assert**:

- Summary has `completedWithErrors === true`
- Failed item: `output: null`, `error` contains 'boom'
- Other items: `output === 'ok'`, `error: null`

#### 8. Scorer error isolation — one scorer fails

**Setup**: Create a failing scorer + a passing scorer:

```ts
const failingScorer = {
  ...createMockScorer('fail', 'fail'),
  run: vi.fn().mockRejectedValue(new Error('scorer-boom')),
};
const passingScorer = createMockScorer('pass', 'pass');

await ds.startExperiment({
  task: async ({ input }) => 'ok',
  scorers: [failingScorer, passingScorer],
});
```

**Assert**:

- Passing scorer has valid scores
- Failing scorer has `score: null`, error captured
- Experiment does not abort

#### 9. Backward compat — targetType + targetId via dataset

**Setup**: Mock an agent, then:

```ts
const result = await ds.startExperiment({
  targetType: 'agent',
  targetId: 'test-agent',
  scorers: [mockScorer],
});
```

**Assert**:

- `result.status === 'completed'`
- Agent's `generate` was called
- Works identically to the existing `runExperiment` path

#### 10. Result persistence — results stored in runsStore

**Setup**: Run experiment via `ds.startExperiment()`
**Assert**:

- `runsStorage.listResults({ runId: result.experimentId, pagination })` returns results
- Each result has `input`, `output`, `groundTruth`

#### 11. experimentId field — pre-created ID flows through

**Setup**: Pre-create a run record, then use its ID:

```ts
const run = await runsStorage.createRun({ datasetId: ds.id, ... });
// Note: startExperiment injects datasetId, so we need to use runExperiment directly
// or verify experimentId is passed through correctly
```

**Assert**:

- `result.experimentId` matches the pre-created run ID
- No new run record created (uses existing)

> NOTE: This may need to test `runExperiment()` directly rather than through `ds.startExperiment()`, since `startExperiment` always creates a new experiment. The goal is to verify the `experimentId` field in `ExperimentConfig` is respected.

#### 12. Factory data source via dataset — not applicable

> `ds.startExperiment()` always uses the dataset's own items (`datasetId: this.id`). The factory `data` path is tested in the Phase 2 tests (`experiment/__tests__/runExperiment.test.ts`). Do NOT test factory data here — it's not exposed through the `Dataset` class API.

### Completion Criteria

- [ ] All 11 tests pass via `pnpm test:core`
- [ ] Generic type params verified in at least one typed test (`ds.startExperiment<QA, Answer>()`)
- [ ] `mastra` argument verified as same instance
- [ ] Scorer receives `groundTruth` (NOT `expectedOutput`) — verifies Phase 0 pipeline
- [ ] Error isolation tests verify other items/scorers still have valid results
- [ ] Backward compat test passes with `targetType` + `targetId`
- [ ] All 4 existing test files still pass: `runExperiment.test.ts`, `p0-regression.test.ts`, `p1-regression.test.ts`, `executor.test.ts`
- [ ] `pnpm build:core` passes

---

## Cross-file verification

After all three test files pass individually:

1. `pnpm test:core` — ALL core tests pass (not just new files)
2. Existing 4 experiment test files pass without modification (backward compat)
3. Storage domain tests (`datasets.test.ts`, `runs.test.ts`) pass with renamed fields
4. No `expectedOutput` or `context` (as dataset item field) in any new test code
5. All `SchemaValidationError.field` assertions use `'groundTruth'`, not `'expectedOutput'`
