# Phase 3 — Public API

> Parallel: **3a ‖ 3b**. Two independent classes that can be implemented simultaneously.

---

## Dependencies

Phase 2 — `runExperiment()` must support inline data + inline task paths.

---

## Post Phase 0 + Phase 1 + Phase 2 state

After prerequisites, the codebase will have:

### Storage types (`packages/core/src/storage/types.ts`)

```ts
// Renamed from `Dataset` in Phase 1a
export interface DatasetRecord {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>; // renamed from outputSchema in Phase 0
  version: Date;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  version: Date;
  input: unknown;
  groundTruth?: unknown; // renamed from expectedOutput in Phase 0
  metadata?: Record<string, unknown>; // renamed from context in Phase 0
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItemVersion {
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

// Input types use same renamed fields
export interface AddDatasetItemInput {
  datasetId: string;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

export interface UpdateDatasetItemInput {
  id: string;
  datasetId: string;
  input?: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

export interface BulkAddItemsInput {
  datasetId: string;
  items: Array<{
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

export interface BulkDeleteItemsInput {
  datasetId: string;
  itemIds: string[];
}

export interface CreateDatasetInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>; // renamed from outputSchema
}

export interface UpdateDatasetInput {
  id: string;
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
}

// Run types
export interface Run {
  id: string;
  datasetId: string;
  status: string;
  datasetVersion: Date;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunResult {
  id: string;
  runId: string; // NOTE: storage layer still uses `runId`
  itemId: string;
  input: unknown;
  output: unknown;
  groundTruth: unknown; // renamed from expectedOutput
  traceId: string | null;
  scorerInput: unknown;
  scorerOutput: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListRunsInput {
  datasetId?: string;
  pagination: StoragePagination;
}

export interface ListRunResultsInput {
  runId: string; // NOTE: storage layer still uses `runId`
  pagination: StoragePagination;
}
```

### Experiment types (`packages/core/src/datasets/experiment/types.ts`)

```ts
// After Phase 1b
export interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  datasetId?: string; // optional — inline data may be used
  targetType?: string; // optional — inline task may be used
  targetId?: string;
  experimentId?: string; // renamed from runId in Phase 1b
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

export interface DataItem<I = unknown, E = unknown> {
  id?: string;
  input: I;
  groundTruth?: E;
  metadata?: Record<string, unknown>;
}

export type StartExperimentConfig<I = unknown, O = unknown, E = unknown> = Omit<
  ExperimentConfig<I, O, E>,
  'datasetId' | 'data' | 'experimentId'
>;

export interface ExperimentSummary {
  experimentId: string; // renamed from runId in Phase 1b
  datasetId: string;
  status: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  results: ItemWithScores[];
}
```

### Storage domain methods (exact signatures)

```ts
// DatasetsStorage (packages/core/src/storage/domains/datasets/base.ts)
abstract createDataset(input: CreateDatasetInput): Promise<DatasetRecord>;
abstract getDatasetById(args: { id: string }): Promise<DatasetRecord | null>;
abstract listDatasets(args: { pagination: StoragePagination }): Promise<ListDatasetsOutput>;
abstract deleteDataset(args: { id: string }): Promise<void>;
// concrete (does validation + versioning):
async updateDataset(input: UpdateDatasetInput): Promise<DatasetRecord>;
async addItem(input: AddDatasetItemInput): Promise<DatasetItem>;
async updateItem(input: UpdateDatasetItemInput): Promise<DatasetItem>;
async deleteItem(input: { id: string; datasetId: string }): Promise<void>;
abstract getItemById(args: { id: string }): Promise<DatasetItem | null>;
abstract listItems(args: { datasetId: string; pagination: StoragePagination }): Promise<ListItemsOutput>;
abstract bulkAddItems(input: BulkAddItemsInput): Promise<DatasetItem[]>;
abstract bulkDeleteItems(input: BulkDeleteItemsInput): Promise<void>;
// Versioning:
abstract listDatasetVersions(args: { datasetId: string; pagination: StoragePagination }): Promise<ListDatasetVersionsOutput>;
abstract getItemsByVersion(args: { datasetId: string; version: Date }): Promise<DatasetItemVersion[]>;
abstract getItemVersion(itemId: string, versionNumber?: number): Promise<DatasetItemVersion | null>;  // POSITIONAL args
abstract listItemVersions(args: { itemId: string; pagination: StoragePagination }): Promise<ListItemVersionsOutput>;

// RunsStorage (packages/core/src/storage/domains/runs/base.ts)
abstract createRun(input: CreateRunInput): Promise<Run>;
abstract updateRun(input: UpdateRunInput): Promise<Run>;
abstract getRunById(args: { id: string }): Promise<Run | null>;
abstract listRuns(args: ListRunsInput): Promise<ListRunsOutput>;
abstract deleteRun(args: { id: string }): Promise<void>;
abstract addResult(input: AddRunResultInput): Promise<RunResult>;
abstract getResultById(args: { id: string }): Promise<RunResult | null>;
abstract listResults(args: ListRunResultsInput): Promise<ListRunResultsOutput>;  // uses `runId`
abstract deleteResultsByRunId(args: { runId: string }): Promise<void>;
```

### Mastra class

```ts
// packages/core/src/mastra/index.ts
#storage?: MastraCompositeStore;

public getStorage(): MastraCompositeStore | undefined {
  return this.#storage;
}
```

### MastraCompositeStore

```ts
// packages/core/src/storage/base.ts
// getStore() is ASYNC
async getStore<K extends keyof StorageDomains>(storeName: K): Promise<StorageDomains[K] | undefined>;
```

### MastraError

```ts
// packages/core/src/error/index.ts
export enum ErrorDomain {
  STORAGE = 'STORAGE',
  // ... others
}

export enum ErrorCategory {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  // ... others
}

// Constructor requires `id` (mandatory Uppercase<string>) and uses `text` (not `message`)
new MastraError({
  id: 'DATASETS_STORAGE_NOT_CONFIGURED', // Uppercase<string>
  text: 'Storage not configured. ...', // NOT `message`
  domain: 'STORAGE',
  category: 'USER',
});
```

### Existing compareExperiments (to be wrapped)

```ts
// packages/core/src/datasets/experiment/analytics/compare.ts
export async function compareExperiments(mastra: Mastra, config: CompareExperimentsConfig): Promise<ComparisonResult>;

// CompareExperimentsConfig uses `runIdA`, `runIdB`, `thresholds`
// ComparisonResult has `runA`, `runB`, `versionMismatch`, `hasRegression`, `scorers`, `items`, `warnings`
// ItemComparison has `itemId`, `inBothRuns`, `scoresA`, `scoresB` — NO `input`, `groundTruth`, `output`
// Uses `scoresStore` in addition to `runsStore`
```

### runExperiment (internal, after Phase 2)

```ts
// packages/core/src/datasets/experiment/index.ts
export async function runExperiment(mastra: Mastra, config: ExperimentConfig): Promise<ExperimentSummary>;
```

---

## Task 3a — `Dataset` class

### Files

| File                                    | Changes                   |
| --------------------------------------- | ------------------------- |
| `packages/core/src/datasets/dataset.ts` | **NEW** — `Dataset` class |

### Constructor

```ts
constructor(id: string, mastra: Mastra)
```

- Stores `id` and `mastra` as private fields.
- Public `.id` property.
- **No eager storage access.** Storage is resolved lazily on first method call.

### Lazy storage resolution

> **CRITICAL**: `MastraCompositeStore.getStore()` is **async**. Cached stores must use async resolution.

```ts
#datasetsStore?: DatasetsStorage;
#runsStore?: RunsStorage;

async #getDatasetsStore(): Promise<DatasetsStorage> {
  if (!this.#datasetsStore) {
    const storage = this.#mastra.getStorage();
    if (!storage) {
      throw new MastraError({
        id: 'DATASETS_STORAGE_NOT_CONFIGURED',
        text: 'Storage not configured. Configure storage in the Mastra instance to use datasets.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    const store = await storage.getStore('datasets');
    if (!store) {
      throw new MastraError({
        id: 'DATASETS_STORE_NOT_AVAILABLE',
        text: 'Datasets storage domain not available.',
        domain: 'STORAGE',
        category: 'SYSTEM',
      });
    }
    this.#datasetsStore = store;
  }
  return this.#datasetsStore;
}

async #getRunsStore(): Promise<RunsStorage> {
  if (!this.#runsStore) {
    const storage = this.#mastra.getStorage();
    if (!storage) {
      throw new MastraError({
        id: 'DATASETS_STORAGE_NOT_CONFIGURED',
        text: 'Storage not configured. Configure storage in the Mastra instance to use datasets.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    const store = await storage.getStore('runs');
    if (!store) {
      throw new MastraError({
        id: 'RUNS_STORE_NOT_AVAILABLE',
        text: 'Runs storage domain not available.',
        domain: 'STORAGE',
        category: 'SYSTEM',
      });
    }
    this.#runsStore = store;
  }
  return this.#runsStore;
}
```

### Imports

```ts
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { RunsStorage } from '../storage/domains/runs/base.js';
import type { DatasetRecord, DatasetItem, DatasetItemVersion } from '../storage/types.js';
import { MastraError } from '../error/index.js';
import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { runExperiment } from './experiment/index.js';
import type { StartExperimentConfig, ExperimentSummary } from './experiment/types.js';
```

Used in `update()` to convert Zod schemas to JSON Schema for `inputSchema` and `groundTruthSchema`.

### Method table — Dataset metadata

| Method                                                                        | Delegates to                                                                | Returns                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `async getDetails()`                                                          | `(await this.#getDatasetsStore()).getDatasetById({ id: this.id })`          | `DatasetRecord` — throws `MastraError` if `null`                              |
| `async update({ description?, metadata?, inputSchema?, groundTruthSchema? })` | `(await this.#getDatasetsStore()).updateDataset({ id: this.id, ...input })` | `DatasetRecord` — throws `SchemaUpdateValidationError` if schema breaks items |

> `inputSchema` and `groundTruthSchema` accept `JSONSchema7 | ZodType`. Zod detected via `isZodType()`, converted via `zodToJsonSchema()` before storage call.

### Method table — Item CRUD

| Method                                                          | Delegates to                                                                                                                 | Returns                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `async addItem({ input, groundTruth?, metadata? })`             | `store.addItem({ datasetId: this.id, input, groundTruth, metadata })`                                                        | `DatasetItem` — throws `SchemaValidationError` if input fails schema |
| `async addItems({ items })`                                     | `store.bulkAddItems({ datasetId: this.id, items })`                                                                          | `DatasetItem[]`                                                      |
| `async getItem({ itemId, version? })`                           | version ? `store.getItemVersion(itemId, version)` : `store.getItemById({ id: itemId })`                                      | `DatasetItem \| DatasetItemVersion \| null`                          |
| `async listItems({ version?, page?, perPage? })`                | version ? `store.getItemsByVersion({ datasetId: this.id, version })` : `store.listItems({ datasetId: this.id, pagination })` | `{ items, pagination }` or `DatasetItemVersion[]`                    |
| `async updateItem({ itemId, input?, groundTruth?, metadata? })` | `store.updateItem({ id: itemId, datasetId: this.id, input, groundTruth, metadata })`                                         | `DatasetItem` — throws `SchemaValidationError`                       |
| `async deleteItem({ itemId })`                                  | `store.deleteItem({ id: itemId, datasetId: this.id })`                                                                       | `void`                                                               |
| `async deleteItems({ itemIds })`                                | `store.bulkDeleteItems({ datasetId: this.id, itemIds })`                                                                     | `void`                                                               |

> **Note**: `getItemVersion()` takes **positional** arguments: `store.getItemVersion(itemId, version)`, NOT an object.

### Method table — Versioning

| Method                                                | Delegates to                                                    | Returns                    |
| ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| `async listVersions({ page?, perPage? })`             | `store.listDatasetVersions({ datasetId: this.id, pagination })` | `{ versions, pagination }` |
| `async listItemVersions({ itemId, page?, perPage? })` | `store.listItemVersions({ itemId, pagination })`                | `{ versions, pagination }` |

Note: `getItemsByVersion` is folded into `listItems({ version })`. `getItemVersion` is folded into `getItem({ itemId, version })`. These are no longer separate methods.

### Method table — Experiments

| Method                                                           | Delegates to                                                     | Returns                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `async startExperiment<I, O, E>(config)`                         | `runExperiment(this.#mastra, { datasetId: this.id, ...config })` | `ExperimentSummary` — awaits completion       |
| `async startExperimentAsync<I, O, E>(config)`                    | Creates run record, spawns `runExperiment()` in background       | `{ experimentId: string, status: 'pending' }` |
| `async listExperiments({ page?, perPage? })`                     | `store.listRuns({ datasetId: this.id, pagination })`             | `{ runs, pagination }`                        |
| `async getExperiment({ experimentId })`                          | `store.getRunById({ id: experimentId })`                         | `Run \| null`                                 |
| `async listExperimentResults({ experimentId, page?, perPage? })` | `store.listResults({ runId: experimentId, pagination })`         | `{ results, pagination }`                     |
| `async deleteExperiment({ experimentId })`                       | `store.deleteRun({ id: experimentId })`                          | `void`                                        |

> **IMPORTANT**: `RunsStorage.listResults()` takes `{ runId: string, pagination }`, not `experimentId`.
> The `Dataset` class translates `experimentId` → `runId` when calling storage.

#### `startExperiment` detail

- Injects `datasetId: this.id` into config before calling internal `runExperiment(this.#mastra, { datasetId: this.id, ...config })`
- Awaits completion
- Returns `ExperimentSummary`

#### `startExperimentAsync` detail

1. Get `runsStore` via `await this.#getRunsStore()`
2. Create a run record via `runsStore.createRun({ datasetId: this.id, ... })` — get `experimentId` from `run.id`
3. Spawn `runExperiment(this.#mastra, { datasetId: this.id, experimentId, ...config })` as a detached promise (`.catch()` for safety)
4. Return `{ experimentId, status: 'pending' }` immediately

### Completion Criteria

- [ ] `new Dataset(id, mastra)` does NOT call storage (no eager access)
- [ ] `ds.getDetails()` returns dataset metadata
- [ ] `ds.addItem({ input, groundTruth?, metadata? })` validates against schema if present
- [ ] `ds.startExperiment({ task, scorers })` injects `datasetId` automatically
- [ ] `ds.startExperimentAsync(config)` returns `{ experimentId, status: 'pending' }` immediately
- [ ] `ds.update({ inputSchema: z.object({...}) })` converts Zod to JSON Schema internally
- [ ] All object parameters (no positional string args in public API)
- [ ] `getItem({ itemId, version })` correctly calls `store.getItemVersion(itemId, version)` with positional args
- [ ] `listExperimentResults({ experimentId })` correctly passes `{ runId: experimentId }` to storage
- [ ] `MastraError` thrown with correct `{ id, text, domain, category }` shape
- [ ] `pnpm build:core` passes

---

## Task 3b — `DatasetsManager` class

### Files

| File                                    | Changes                           |
| --------------------------------------- | --------------------------------- |
| `packages/core/src/datasets/manager.ts` | **NEW** — `DatasetsManager` class |

### Constructor

```ts
constructor(mastra: Mastra)
```

- Stores `mastra` as private field.
- **No eager storage access.**

### Lazy storage resolution

> **CRITICAL**: `MastraCompositeStore.getStore()` is **async**. Same pattern as `Dataset` class.

```ts
#datasetsStore?: DatasetsStorage;
#runsStore?: RunsStorage;

async #getDatasetsStore(): Promise<DatasetsStorage> {
  if (!this.#datasetsStore) {
    const storage = this.#mastra.getStorage();
    if (!storage) {
      throw new MastraError({
        id: 'DATASETS_STORAGE_NOT_CONFIGURED',
        text: 'Storage not configured. Configure storage in the Mastra instance to use datasets.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    const store = await storage.getStore('datasets');
    if (!store) {
      throw new MastraError({
        id: 'DATASETS_STORE_NOT_AVAILABLE',
        text: 'Datasets storage domain not available.',
        domain: 'STORAGE',
        category: 'SYSTEM',
      });
    }
    this.#datasetsStore = store;
  }
  return this.#datasetsStore;
}

async #getRunsStore(): Promise<RunsStorage> {
  // Same pattern as above with 'runs' store
}
```

### Imports

```ts
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { RunsStorage } from '../storage/domains/runs/base.js';
import { MastraError } from '../error/index.js';
import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { Dataset } from './dataset.js';
import { compareExperiments as compareExperimentsInternal } from './experiment/analytics/compare.js';
```

Used in `create()` to convert Zod schemas for `inputSchema` and `groundTruthSchema`.

### Method table — Dataset CRUD

| Method                                                                              | Delegates to                                    | Returns                    |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------- |
| `async create({ name, description?, inputSchema?, groundTruthSchema?, metadata? })` | `store.createDataset(input)`                    | `Dataset` instance         |
| `async get({ id })`                                                                 | `store.getDatasetById({ id })` + throws if null | `Dataset` instance         |
| `async list({ page?, perPage? })`                                                   | `store.listDatasets({ pagination })`            | `{ datasets, pagination }` |
| `async delete({ id })`                                                              | `store.deleteDataset({ id })`                   | `void`                     |

> `inputSchema` and `groundTruthSchema` in `create()` accept `JSONSchema7 | ZodType`. Zod detected via `isZodType()`, converted via `zodToJsonSchema()` before storage call.

### Method table — Cross-dataset experiment operations

| Method                                                     | Delegates to                                                    | Returns                |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `async getExperiment({ experimentId })`                    | `(await this.#getRunsStore()).getRunById({ id: experimentId })` | `Run \| null`          |
| `async compareExperiments({ experimentIds, baselineId? })` | wraps internal `compareExperimentsInternal(mastra, config)`     | MVP `ComparisonResult` |

#### `create()` detail

1. Convert Zod schemas if present via `isZodType()` + `zodToJsonSchema()`
2. Call `(await this.#getDatasetsStore()).createDataset({ name, description, inputSchema, groundTruthSchema, metadata })`
3. Return `new Dataset(result.id, this.#mastra)`

#### `get()` detail

1. Call `(await this.#getDatasetsStore()).getDatasetById({ id })`
2. If `null` → throw `MastraError({ id: 'DATASET_NOT_FOUND', text: 'Dataset not found', domain: 'STORAGE', category: 'USER' })`
3. Return `new Dataset(id, this.#mastra)`

#### `compareExperiments()` detail — MVP

The existing `compareExperiments(mastra, config)` function (`analytics/compare.ts`) uses `runIdA`/`runIdB` and returns a rich `ComparisonResult` with `runA`, `runB`, `versionMismatch`, `hasRegression`, `scorers`, `items`, `warnings`.

For the MVP public API, `DatasetsManager.compareExperiments()` wraps the internal function:

```ts
async compareExperiments({
  experimentIds,
  baselineId,
}: {
  experimentIds: string[];   // validated: length >= 2
  baselineId?: string;
}): Promise<{ baselineId: string; items: ComparisonItem[] }> {
  if (experimentIds.length < 2) {
    throw new MastraError({
      id: 'COMPARE_INVALID_INPUT',
      text: 'compareExperiments requires at least 2 experiment IDs.',
      domain: 'STORAGE',
      category: 'USER',
    });
  }

  const resolvedBaseline = baselineId ?? experimentIds[0]!;

  // MVP: compare first two only, wrap existing function
  const internal = await compareExperimentsInternal(this.#mastra, {
    runIdA: resolvedBaseline,
    runIdB: experimentIds.find(id => id !== resolvedBaseline) ?? experimentIds[1]!,
  });

  // Transform to MVP shape: baselineId + items
  // NOTE: existing ItemComparison has { itemId, inBothRuns, scoresA, scoresB }
  // MVP adds: input, groundTruth, and per-experiment results keyed by experimentId
  // This requires loading run results to get input/output/groundTruth per item
  const runsStore = await this.#getRunsStore();

  const [resultsA, resultsB] = await Promise.all([
    runsStore.listResults({ runId: internal.runA.id, pagination: { page: 0, perPage: false } }),
    runsStore.listResults({ runId: internal.runB.id, pagination: { page: 0, perPage: false } }),
  ]);

  // Index results by itemId
  const resultsMapA = new Map(resultsA.results.map(r => [r.itemId, r]));
  const resultsMapB = new Map(resultsB.results.map(r => [r.itemId, r]));

  const items = internal.items.map(item => {
    const resultA = resultsMapA.get(item.itemId);
    const resultB = resultsMapB.get(item.itemId);

    return {
      itemId: item.itemId,
      input: resultA?.input ?? resultB?.input ?? null,
      groundTruth: resultA?.groundTruth ?? resultB?.groundTruth ?? null,
      results: {
        [internal.runA.id]: resultA ? { output: resultA.output, scores: item.scoresA } : null,
        [internal.runB.id]: resultB ? { output: resultB.output, scores: item.scoresB } : null,
      } as Record<string, { output: unknown; scores: Record<string, number | null> } | null>,
    };
  });

  return {
    baselineId: resolvedBaseline,
    items,
  };
}
```

**Deferred:** N-way comparison (> 2 experiments), `warnings`, `diff` (version context, `itemsOnlyIn`, `itemsModified`), per-scorer aggregated stats.

### Completion Criteria

- [ ] `new DatasetsManager(mastra)` does NOT call storage (no eager access)
- [ ] First method call with no storage → throws `MastraError` with `{ id: 'DATASETS_STORAGE_NOT_CONFIGURED', domain: 'STORAGE', category: 'USER' }`
- [ ] `mgr.create({ name, inputSchema: z.object({...}) })` converts Zod to JSON Schema
- [ ] `mgr.create()` returns a `Dataset` instance with `.id`
- [ ] `mgr.get({ id })` returns `Dataset` instance, throws `MastraError` on not found
- [ ] `mgr.list()` returns `{ datasets, pagination }`
- [ ] `mgr.compareExperiments({ experimentIds: [a, b] })` returns `{ baselineId, items }`
- [ ] `mgr.compareExperiments({ experimentIds: [a] })` throws `MastraError`
- [ ] `compareExperiments` items include `input`, `groundTruth`, and per-experiment `output` + `scores`
- [ ] `pnpm build:core` passes

---

## Tests for Phase 3

### Tests for `dataset.test.ts`

1. **Lazy storage — no storage call on construction**
   - `new Dataset('test-id', mastra)` — verify no storage methods called

2. **Lazy storage — MastraError on missing storage**
   - `mastra.getStorage()` returns `undefined` → `ds.getDetails()` throws `MastraError` with `id: 'DATASETS_STORAGE_NOT_CONFIGURED'`

3. **Lazy storage — caches store after first resolve**
   - Call `ds.getDetails()` twice → `storage.getStore('datasets')` called once

4. **getDetails — delegates correctly**
   - Calls `datasetsStore.getDatasetById({ id })` → returns result
   - Returns `null` → throws `MastraError`

5. **update — Zod schema conversion**
   - `ds.update({ inputSchema: z.object({ q: z.string() }) })` → `isZodType` detects Zod, `zodToJsonSchema` called, JSON Schema passed to storage

6. **addItem — delegates with datasetId**
   - `ds.addItem({ input: { q: 'test' } })` → calls `store.addItem({ datasetId: 'test-id', input: { q: 'test' } })`

7. **getItem — routes by version**
   - Without version: `ds.getItem({ itemId: 'item-1' })` → calls `store.getItemById({ id: 'item-1' })`
   - With version: `ds.getItem({ itemId: 'item-1', version: 3 })` → calls `store.getItemVersion('item-1', 3)` (positional args)

8. **listItems — routes by version**
   - Without version: `ds.listItems({})` → calls `store.listItems({ datasetId, pagination })`
   - With version: `ds.listItems({ version: someDate })` → calls `store.getItemsByVersion({ datasetId, version: someDate })`

9. **startExperiment — injects datasetId**
   - `ds.startExperiment({ task: ..., scorers: [...] })` → calls `runExperiment(mastra, { datasetId: 'test-id', task: ..., scorers: [...] })`

10. **startExperimentAsync — returns pending**
    - Creates run record, spawns background, returns `{ experimentId: 'run-id', status: 'pending' }`

11. **listExperimentResults — translates experimentId to runId**
    - `ds.listExperimentResults({ experimentId: 'exp-1' })` → calls `store.listResults({ runId: 'exp-1', pagination })`

12. **deleteExperiment — delegates**
    - `ds.deleteExperiment({ experimentId: 'exp-1' })` → calls `store.deleteRun({ id: 'exp-1' })`

13. **SchemaValidationError propagation**
    - `ds.addItem()` with invalid input → `SchemaValidationError` propagates from storage layer

### Tests for `manager.test.ts`

1. **Lazy storage — no storage call on construction**
   - `new DatasetsManager(mastra)` — verify no storage methods called

2. **Lazy storage — MastraError on missing storage**
   - `mastra.getStorage()` returns `undefined` → `mgr.create(...)` throws `MastraError`

3. **create — returns Dataset instance**
   - `mgr.create({ name: 'test' })` → returns `Dataset` with `.id`

4. **create — Zod schema support**
   - `mgr.create({ name: 'test', inputSchema: z.object({...}) })` → Zod converted

5. **get — returns Dataset instance**
   - `mgr.get({ id: 'ds-1' })` → calls `store.getDatasetById`, returns `Dataset`

6. **get — throws on not found**
   - `store.getDatasetById` returns `null` → throws `MastraError` with `id: 'DATASET_NOT_FOUND'`

7. **list — returns datasets and pagination**
   - `mgr.list({})` → returns `{ datasets, pagination }`

8. **delete — delegates**
   - `mgr.delete({ id: 'ds-1' })` → calls `store.deleteDataset({ id: 'ds-1' })`

9. **compareExperiments — MVP shape**
   - Returns `{ baselineId, items }` with `items[].input`, `items[].groundTruth`, `items[].results`

10. **compareExperiments — validation**
    - `mgr.compareExperiments({ experimentIds: ['a'] })` → throws `MastraError`

11. **mastra.datasets — singleton**
    - `mastra.datasets === mastra.datasets` (same instance)
