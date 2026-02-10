# Datasets API — Implementation Plan (Final)

## CONTEXT

Datasets are the only major domain in Mastra without a first-class programmatic API. Users must go through HTTP endpoints or raw storage access. This plan introduces `DatasetsManager` and `Dataset` classes and evolves the existing `runExperiment()` function to support Braintrust-style ergonomics.

**Key decisions:**

- Single `runExperiment()` engine — the existing function is extended with inline data, inline tasks, and generic type params. It is **internal only** — never publicly exported.
- Public API is `ds.startExperiment()` (await result) and `ds.startExperimentAsync()` (fire-and-forget) on `Dataset`. Naming follows the `run.start()` / `run.startAsync()` pattern from Workflow Run.
- No `eval()` wrapper on `Mastra` class or `Dataset`.
- No breaking changes to the existing internal `runExperiment()` signature — all new fields are optional.

**Pre-requisite renames (Phase 0):**

- `expectedOutput` → `groundTruth` on dataset items and run results (~250 refs, 25+ files)
- Item-level `context` → `metadata` (~65 refs, 20+ files)
- Dataset-level `outputSchema` → `groundTruthSchema` (DB column + types)
- See `phases/phase-00-rename.md` for full file inventory.

**Implementation phases:** `phases/phase-00-rename.md` through `phases/phase-07-verification.md`.

---

## ARCHITECTURE

```
Mastra
  └── get datasets(): DatasetsManager        (lazy, deferred storage check)
        ├── create() → Dataset
        ├── get() → Dataset
        ├── list()
        ├── delete()
        ├── getExperiment()
        └── compareExperiments()

Dataset (bound to one dataset ID)
  ├── getDetails() / update()
  ├── addItem() / addItems() / getItem() / listItems() / updateItem() / deleteItem() / deleteItems()
  ├── listVersions() / listItemVersions()
  ├── startExperiment() / startExperimentAsync() / listExperiments() / getExperiment()
  └── listExperimentResults() / deleteExperiment()

runExperiment(mastra, config)                 (INTERNAL engine — not publicly exported)
  ├── Data source:   config.datasetId | config.data (array | factory)
  ├── Task:          config.targetType+targetId | config.task (inline function)
  ├── Scorers:       MastraScorer | string ID
  └── Extras:        maxConcurrency, signal, itemTimeout
```

Both `DatasetsManager` and `Dataset` delegate to existing `DatasetsStorage` and `RunsStorage` domain stores. No new storage methods required.

---

## EXISTING CODE TO REUSE

| What                                          | Where                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `runExperiment()`                             | `packages/core/src/datasets/experiment/index.ts` — extend in-place               |
| `executeTarget()`                             | `packages/core/src/datasets/experiment/executor.ts` — reuse for registry targets |
| `resolveScorers()`, `runScorersForItem()`     | `packages/core/src/datasets/experiment/scorer.ts` — unchanged                    |
| `compareExperiments()`                        | `packages/core/src/datasets/experiment/analytics/compare.ts` — wrap              |
| `MastraError`, `ErrorDomain`, `ErrorCategory` | `packages/core/src/error/index.ts`                                               |
| All storage types                             | `packages/core/src/storage/types.ts`                                             |
| `DatasetsStorage`                             | `packages/core/src/storage/domains/datasets/base.ts`                             |
| `RunsStorage`                                 | `packages/core/src/storage/domains/runs/base.ts`                                 |
| `DatasetsInMemory`                            | `packages/core/src/storage/domains/datasets/inmemory.ts` (tests)                 |
| `RunsInMemory`                                | `packages/core/src/storage/domains/runs/inmemory.ts` (tests)                     |
| `p-map`                                       | Already a dependency                                                             |

---

## UNIFIED `runExperiment()` — CORE CHANGE

### Current signature (L38 of `experiment/index.ts`)

```ts
async function runExperiment(mastra: Mastra, config: ExperimentConfig): Promise<ExperimentSummary>;
```

### Evolved `ExperimentConfig` (generic)

```ts
/**
 * A single data item for inline experiment data.
 */
interface DataItem<I = unknown, E = unknown> {
  /** Unique ID (auto-generated if omitted) */
  id?: string;
  /** Input data passed to task */
  input: I;
  /** Ground truth for scoring */
  groundTruth?: E;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Internal configuration for running a dataset experiment.
 * Not publicly exported — users interact via Dataset.startExperiment().
 * All new fields are optional — existing internal callers are unaffected.
 */
interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  // === Data source (pick one — Dataset always injects datasetId) ===

  /** ID of dataset in storage (injected by Dataset) */
  datasetId?: string;
  /** Override data source — inline array or async factory (bypasses storage load) */
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>);

  // === Task execution (pick one) ===

  /** Registry-based target type (existing) */
  targetType?: TargetType;
  /** Registry-based target ID (existing) */
  targetId?: string;
  /** Inline task function (sync or async) */
  task?: (args: {
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;

  // === Scoring ===

  /** Scorers — MastraScorer instances or string IDs */
  scorers?: (MastraScorer<any, any, any, any> | string)[];

  // === Options ===

  /** Pin to specific dataset version (default: latest). Only applies when datasetId is used. */
  version?: Date;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Per-item execution timeout in milliseconds */
  itemTimeout?: number;
  /** Pre-created experiment ID (for async trigger — skips run creation) */
  experimentId?: string;
  /** Experiment name (used for display / grouping) */
  name?: string;
}
```

### Public `StartExperimentConfig` (what users pass to `ds.startExperiment()`)

```ts
/**
 * Configuration for starting an experiment on a dataset.
 * The dataset is always the data source — no datasetId/data needed.
 *
 * Generic type params are optional. Without them, input/output default to `unknown`
 * and the task callback receives `unknown` — users must cast or narrow manually.
 *
 * With generics:
 *   ds.startExperiment<{ question: string }, { answer: string }>({ task: ... })
 * TypeScript will type-check the task's input and return value.
 */
interface StartExperimentConfig<I = unknown, O = unknown, E = unknown> {
  // === Task execution (pick one) ===

  /** Registry-based target type */
  targetType?: TargetType;
  /** Registry-based target ID */
  targetId?: string;
  /** Inline task function (sync or async) */
  task?: (args: {
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;

  // === Scoring ===

  /** Scorers — MastraScorer instances or string IDs */
  scorers?: (MastraScorer<any, any, any, any> | string)[];

  // === Options ===

  /** Pin to specific dataset version (default: latest) */
  version?: Date;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Per-item execution timeout in milliseconds */
  itemTimeout?: number;
  /** Experiment name (used for display / grouping) */
  name?: string;
}
```

Note: `datasetId`, `data`, and `experimentId` are **not** on `StartExperimentConfig` — the `Dataset` instance injects `datasetId` internally.

### Implementation changes to `runExperiment()`

The function will be refactored into 3 resolution phases before the existing p-map loop:

**Phase 1 — Resolve items:**

```
if config.data:
  - Array → map to DatasetItem-like objects (generate IDs if missing)
  - Factory → await factory(), then map like array
else:
  - Use existing datasetId path (unchanged — Dataset always injects datasetId)
Validation: at least one of data or datasetId must be provided.
```

**Phase 2 — Resolve task function:**

```
if config.task:
  - Wrap as: (item, signal) => { output, error, traceId, scorerInput, scorerOutput }
else:
  - Use existing resolveTarget() + executeTarget() path (unchanged)
Validation: at least one of task or (targetType + targetId) must be provided.
```

**Phase 3 — Resolve scorers:** Unchanged — `MastraScorer` instances used as-is, string IDs resolved from mastra registry.

**p-map loop:** Remains structurally identical. Calls `execFn(item, signal)` instead of `executeTarget(target, targetType, item, { signal })`.

**Persistence:** All experiments are run through a `Dataset`, which requires storage. Results are always persisted to `runsStore`. Tracing is always active through the `Mastra` instance.

### Backward compatibility

- All new fields are optional
- Existing internal `{ datasetId, targetType, targetId, scorers }` calls work unchanged
- The only required invariant: must provide at least one data source and one task source
- `runExperiment()` is internal — callers always go through `Dataset.startExperiment()` which injects `datasetId` and `mastra`

---

## FILES TO CREATE

### 1. `packages/core/src/datasets/dataset.ts` (NEW)

`Dataset` — bound to a single dataset ID. Returned by `manager.create()` and `manager.get()`.

**Constructor:** Takes `id: string`, `storage: MastraCompositeStore`, `mastra: Mastra`. No eager storage access.

**Lazy storage resolution:**

- `#getDatasetsStore()` — resolves `storage.getStore('datasets')` on first call, caches result
- `#getRunsStore()` — resolves `storage.getStore('runs')` on first call, caches result
- Throws `MastraError` (domain: `STORAGE`, category: `USER`) if store not configured

**Dataset metadata:**

| Method                                                                  | Delegates to                                    | Returns                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `getDetails()`                                                          | `datasetsStore.getDatasetById({ id })`          | `DatasetRecord` — throws if not found                                         |
| `update({ description?, metadata?, inputSchema?, groundTruthSchema? })` | `datasetsStore.updateDataset({ id, ...input })` | `DatasetRecord` — throws `SchemaUpdateValidationError` if schema breaks items |

> **Zod schema support:** `inputSchema` and `groundTruthSchema` in `update()` also accept Zod schemas. The same `isZodType()` / `zodToJsonSchema()` conversion applies before passing to storage.

**Item CRUD:**

| Method                                                    | Delegates to                                                                                                                    | Returns                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `addItem({ input, groundTruth?, metadata? })`             | `datasetsStore.addItem({ datasetId: id, ...opts })`                                                                             | `DatasetItem` — throws `SchemaValidationError` if input fails schema |
| `addItems({ items })`                                     | `datasetsStore.bulkAddItems({ datasetId: id, items })`                                                                          | `DatasetItem[]`                                                      |
| `getItem({ itemId, version? })`                           | version ? `datasetsStore.getItemVersion(itemId, version)` : `datasetsStore.getItemById({ id: itemId })`                         | `DatasetItem \| DatasetItemVersion \| null`                          |
| `listItems({ version?, page?, perPage? })`                | version ? `datasetsStore.getItemsByVersion({ datasetId: id, version })` : `datasetsStore.listItems({ datasetId: id, ...opts })` | `{ items, pagination }`                                              |
| `updateItem({ itemId, input?, groundTruth?, metadata? })` | `datasetsStore.updateItem({ id: itemId, datasetId: id, ...opts })`                                                              | `DatasetItem` — throws `SchemaValidationError`                       |
| `deleteItem({ itemId })`                                  | `datasetsStore.deleteItem({ id: itemId, datasetId: id })`                                                                       | `void`                                                               |
| `deleteItems({ itemIds })`                                | `datasetsStore.bulkDeleteItems({ datasetId: id, itemIds })`                                                                     | `void`                                                               |

**Versioning:**

| Method                                          | Delegates to                                                    | Returns                    |
| ----------------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| `listVersions({ page?, perPage? })`             | `datasetsStore.listDatasetVersions({ datasetId: id, ...opts })` | `{ versions, pagination }` |
| `listItemVersions({ itemId, page?, perPage? })` | `datasetsStore.listItemVersions({ itemId, ...opts })`           | `{ versions, pagination }` |

Note: `getItemsByVersion` is folded into `listItems({ version })`. `getItemVersion` is folded into `getItem({ itemId, version })`. These are no longer separate methods.

**Experiments:**

| Method                                                                  | Delegates to                                               | Returns                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `startExperiment<I, O, E>(config: StartExperimentConfig<I, O, E>)`      | `runExperiment(mastra, { datasetId: id, ...config })`      | `ExperimentSummary` — awaits completion |
| `startExperimentAsync<I, O, E>(config: StartExperimentConfig<I, O, E>)` | Creates run record, spawns `runExperiment()` in background | `{ experimentId, status: 'pending' }`   |
| `listExperiments({ page?, perPage? })`                                  | `runsStore.listRuns({ datasetId: id, ...opts })`           | `{ runs, pagination }`                  |
| `getExperiment({ experimentId })`                                       | `runsStore.getRunById({ id: experimentId })`               | `Run \| null`                           |
| `listExperimentResults({ experimentId, page?, perPage? })`              | `runsStore.listResults({ experimentId, ...opts })`         | `{ results, pagination }`               |
| `deleteExperiment({ experimentId })`                                    | `runsStore.deleteRun({ id: experimentId })`                | `void`                                  |

---

### 2. `packages/core/src/datasets/manager.ts` (NEW)

`DatasetsManager` — accessed via `mastra.datasets`.

**Constructor:** Takes `mastra: Mastra`. Stores reference. No eager storage access.

**Lazy storage resolution:**

- `#getDatasetsStore()` — resolves `mastra.getStorage()?.getStore('datasets')` on first call, caches result
- `#getRunsStore()` — resolves `mastra.getStorage()?.getStore('runs')` on first call, caches result
- Throws `MastraError` (domain: `STORAGE`, category: `USER`) if store not configured

**Dataset CRUD:**

| Method                                                                        | Delegates to                                            | Returns                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------- |
| `create({ name, description?, inputSchema?, groundTruthSchema?, metadata? })` | `datasetsStore.createDataset(input)`                    | `Dataset`                  |
| `get({ id })`                                                                 | `datasetsStore.getDatasetById({ id })` + throws if null | `Dataset`                  |
| `list({ page?, perPage? })`                                                   | `datasetsStore.listDatasets(opts)`                      | `{ datasets, pagination }` |
| `delete({ id })`                                                              | `datasetsStore.deleteDataset({ id })`                   | `void`                     |

> **Zod schema support:** `inputSchema` and `groundTruthSchema` in `create()` accept either a JSON Schema object or a Zod schema. Internally, Zod schemas are detected via `isZodType()` and converted to JSON Schema using `zodToJsonSchema()` from `@mastra/schema-compat` before being passed to storage.

**Cross-dataset experiment operations:**

| Method                                               | Delegates to                                 | Returns                                          |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `getExperiment({ experimentId })`                    | `runsStore.getRunById({ id: experimentId })` | `Run \| null`                                    |
| `compareExperiments({ experimentIds, baselineId? })` | `compareExperiments(mastra, config)`         | `ComparisonResult` (MVP: `baselineId` + `items`) |

---

## FILES TO MODIFY

### 3. `packages/core/src/datasets/experiment/types.ts`

Add new types and extend `ExperimentConfig`:

```ts
// New internal types
export interface DataItem<I = unknown, E = unknown> { ... }

// Internal — extended with generics + new optional fields
export interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  // existing fields (unchanged, now optional where needed)
  datasetId?: string;
  targetType?: TargetType;
  targetId?: string;
  scorers?: (MastraScorer<any, any, any, any> | string)[];
  version?: Date;
  maxConcurrency?: number;
  signal?: AbortSignal;
  itemTimeout?: number;
  experimentId?: string;

  // new fields
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>);
  task?: (args: { input: I; mastra: Mastra; groundTruth?: E; metadata?: Record<string, unknown>; signal?: AbortSignal }) => O | Promise<O>;
  name?: string;
}

// PUBLIC — what users pass to ds.startExperiment(). Omits datasetId, data, experimentId.
export type StartExperimentConfig<I = unknown, O = unknown, E = unknown> =
  Omit<ExperimentConfig<I, O, E>, 'datasetId' | 'data' | 'experimentId'>;
```

Note: `datasetId` becomes optional on internal `ExperimentConfig` (was required). Generic defaults (`unknown`) preserve backward compat. `StartExperimentConfig` is derived from `ExperimentConfig` via `Omit`.

**Schema type for `create()` / `update()`:** The `inputSchema` and `groundTruthSchema` parameters on `DatasetsManager.create()` and `Dataset.update()` should use the union type `JSONSchema7 | ZodType`, accepting either a raw JSON Schema object or a Zod schema instance. Import `JSONSchema7` from `@mastra/schema-compat` and `ZodType` from `zod`.

### 4. `packages/core/src/datasets/experiment/index.ts`

Refactor `runExperiment()` implementation:

1. Add item resolution phase (before existing L64-78)
2. Add task resolution phase (before existing L80-84)
3. Replace `executeTarget(target, targetType, item, ...)` with `execFn(item, signal)` in the p-map mapper

The p-map loop (L118-205), run lifecycle management (L89-108, L232-244), and error handling (L206-230) remain structurally identical.

### 5. `packages/core/src/storage/types.ts`

Rename the `Dataset` interface to `DatasetRecord` to avoid collision with the new `Dataset` class:

```ts
// BEFORE:
export interface Dataset { id: string; name: string; ... }

// AFTER:
export interface DatasetRecord { id: string; name: string; ... }
```

Update all references to `Dataset` (the interface) across the codebase — storage domains, server handlers, experiment code. This is safe because the feature hasn't shipped yet.

### 7. `packages/core/src/datasets/index.ts`

Add exports:

```ts
export { DatasetsManager } from './manager';
export { Dataset } from './dataset';
export type { StartExperimentConfig } from './experiment/types';
// Note: DataItem, ExperimentConfig are NOT exported — they are internal.
// Users interact with StartExperimentConfig via Dataset.startExperiment().
```

### 8. `packages/core/src/mastra/index.ts`

Two changes:

- Import: `import { DatasetsManager } from '../datasets/manager';`
- Private field (near other private fields): `#datasets?: DatasetsManager;`
- Lazy getter (near `getStorage()`):

```ts
get datasets(): DatasetsManager {
  if (!this.#datasets) {
    this.#datasets = new DatasetsManager(this);
  }
  return this.#datasets;
}
```

Note: No storage check in the getter. The `DatasetsManager` defers the check to the first method call. This avoids breaking code that instantiates `Mastra` without storage but never touches datasets.

### 9. `packages/core/src/index.ts`

Add re-exports:

```ts
export { DatasetsManager, Dataset } from './datasets';
export type { StartExperimentConfig } from './datasets';
```

### 10. `packages/server/src/server/handlers/datasets.ts`

Refactor all 20 handlers. Replace repeated boilerplate:

```ts
// BEFORE (every handler):
const datasetsStore = await mastra.getStorage()?.getStore('datasets');
if (!datasetsStore) {
  throw new HTTPException(500, { message: 'Datasets storage not configured' });
}
const result = await datasetsStore.someMethod(...);

// AFTER:
const result = await mastra.datasets.someMethod(...);
// or for item/experiment ops on a specific dataset:
const ds = await mastra.datasets.get(datasetId);
const result = await ds.someMethod(...);
```

Handler mapping:

| Handler                   | After                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `LIST_DATASETS`           | `mgr.list({ page, perPage })`                                 |
| `CREATE_DATASET`          | `mgr.create({ name, ... })` → `ds.getDetails()`               |
| `GET_DATASET`             | `mgr.get({ id })` → `ds.getDetails()`                         |
| `UPDATE_DATASET`          | `ds.update({ description?, metadata? })`                      |
| `DELETE_DATASET`          | `mgr.delete({ id })`                                          |
| `LIST_ITEMS`              | `ds.listItems({ version?, page?, perPage? })`                 |
| `ADD_ITEM`                | `ds.addItem({ input, groundTruth?, metadata? })`              |
| `GET_ITEM`                | `ds.getItem({ itemId, version? })`                            |
| `UPDATE_ITEM`             | `ds.updateItem({ itemId, input?, ... })`                      |
| `DELETE_ITEM`             | `ds.deleteItem({ itemId })`                                   |
| `BULK_ADD_ITEMS`          | `ds.addItems({ items })`                                      |
| `BULK_DELETE_ITEMS`       | `ds.deleteItems({ itemIds })`                                 |
| `LIST_DATASET_VERSIONS`   | `ds.listVersions({ page?, perPage? })`                        |
| `GET_ITEMS_BY_VERSION`    | `ds.listItems({ version })`                                   |
| `LIST_ITEM_VERSIONS`      | `ds.listItemVersions({ itemId })`                             |
| `GET_ITEM_VERSION`        | `ds.getItem({ itemId, version })`                             |
| `LIST_EXPERIMENTS`        | `ds.listExperiments({ page?, perPage? })`                     |
| `TRIGGER_EXPERIMENT`      | `ds.startExperimentAsync(config)`                             |
| `GET_EXPERIMENT`          | `ds.getExperiment({ experimentId })`                          |
| `LIST_EXPERIMENT_RESULTS` | `ds.listExperimentResults({ experimentId, page?, perPage? })` |
| `DELETE_EXPERIMENT`       | `ds.deleteExperiment({ experimentId })`                       |
| `COMPARE_EXPERIMENTS`     | `mgr.compareExperiments({ experimentIds, baselineId? })`      |

Key notes:

- Remove all `getStore('datasets')` and `getStore('runs')` calls
- Remove storage-not-configured guards (manager handles this)
- Keep `SchemaValidationError` / `SchemaUpdateValidationError` catches (they bubble through)
- Keep `handleError` wrappers
- `TRIGGER_EXPERIMENT_ROUTE` uses `ds.startExperimentAsync()` instead of manual fire-and-forget

---

## FILES TO CREATE (TESTS)

### 11. `packages/core/src/datasets/__tests__/manager.test.ts` (NEW)

Test categories:

1. **Construction** — stores Mastra ref, no eager storage access
2. **Storage not configured** — throws `MastraError` with appropriate message on first method call
3. **Dataset CRUD** — mock storage, verify delegation. `create()` returns `Dataset`. `get()` throws on missing.
4. **`list()`** — paginates, returns empty array when no datasets
5. **`delete()`** — delegates correctly
6. **Cross-dataset ops** — `getExperiment()` returns `null` for missing, `compareExperiments()` delegates
7. **Lazy resolution caching** — `getStore()` called only once across multiple method calls
8. **`mastra.datasets` getter** — returns same `DatasetsManager` instance on repeated access

### 12. `packages/core/src/datasets/__tests__/dataset.test.ts` (NEW)

Test categories:

1. **Item CRUD** — `addItem()`, `addItems()`, `getItem()`, `listItems()`, `updateItem()`, `deleteItem()`, `deleteItems()`
2. **Versioning** — `listVersions()`, `listItemVersions()`, `listItems({ version })`, `getItem({ itemId, version })`
3. **Experiments** — `startExperiment()` delegates with correct `datasetId`, `startExperimentAsync()` returns `{ experimentId, status: 'pending' }` immediately
4. **Experiment reads** — `listExperiments()`, `getExperiment()`, `listExperimentResults()`, `deleteExperiment()`
5. **Stale dataset** — `getDetails()` throws if dataset deleted between `get()` and method call
6. **Schema validation** — `addItem()` throws `SchemaValidationError`, `update()` throws `SchemaUpdateValidationError`
7. **Pagination** — verify opts forwarding for all list methods

### 13. `packages/core/src/datasets/__tests__/experiment.test.ts` (NEW)

Test categories:

1. **Inline task via dataset** — `ds.startExperiment({ task, scorers })`, types flow, results persisted
2. **Factory function data source** — `ds.startExperiment({ data: async () => [...], task, scorers })`
3. **Scorer error isolation** — one failing scorer doesn't affect others
4. **Task error isolation** — one failing item doesn't fail experiment
5. **Result persistence** — results always persisted to runsStore, tracing always active
6. **Backward compat** — existing `{ targetType, targetId }` calls via dataset still work

---

## ERROR HANDLING

| Situation                                        | Behavior                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `mastra.datasets` — no storage                   | No throw (getter is safe). First method call throws `MastraError`                    |
| `manager.get({ id })` — not found                | **Throws** `MastraError`                                                             |
| `manager.list()` — empty                         | Returns `{ datasets: [], pagination }`                                               |
| `manager.delete({ id })` — not found             | **Throws** (storage layer)                                                           |
| `ds.getDetails()` — deleted                      | **Throws**                                                                           |
| `ds.getItem({ itemId })` — not found             | Returns `null`                                                                       |
| `ds.getExperiment({ experimentId })` — not found | Returns `null`                                                                       |
| `ds.addItem()` — fails schema                    | **Throws** `SchemaValidationError`                                                   |
| `ds.update()` — schema breaks items              | **Throws** `SchemaUpdateValidationError`                                             |
| `ds.startExperiment()` — bad target              | **Throws** (registry target not found)                                               |
| `ds.startExperiment()` — no task source          | **Throws** `Error('No task: provide targetType+targetId or task')`                   |
| `ds.startExperiment()` — task throws for item    | Error isolated per item: `output: null, error: message` in results                   |
| `ds.startExperiment()` — scorer throws           | Error isolated per scorer: `score: null, error: message` in results                  |
| Store not configured                             | **Throws** `MastraError` (domain: `STORAGE`, category: `USER`) on first store access |

---

## IMPLEMENTATION PHASES

### Phase 1 — Foundation (sequential)

Two tasks, done in order. No runtime behavior changes.

**1a. Rename `Dataset` → `DatasetRecord`**

Files:

- `packages/core/src/storage/types.ts` — rename interface + `ListDatasetsOutput.datasets`
- `packages/core/src/storage/domains/datasets/base.ts` — 5 type refs
- `packages/core/src/storage/domains/datasets/inmemory.ts` — 6 type refs
- `stores/libsql/src/storage/domains/datasets/index.ts` — 5 type refs
- `packages/core/src/storage/domains/inmemory-db.ts` — import at L10, `Map<string, Dataset>` at L43
- `client-sdks/client-js/src/types.ts` — rename parallel `Dataset` interface
- `client-sdks/client-js/src/client.ts` — 4 type refs
- `packages/playground-ui/src/domains/datasets/` — 3 files

Completion criteria:

- [ ] `grep 'interface Dataset ' packages/core/src/storage/types.ts` → zero matches
- [ ] `grep 'interface DatasetRecord ' packages/core/src/storage/types.ts` → 1 match
- [ ] `grep ': Dataset[^IRV]' packages/core/src/storage/` → zero matches (no bare `Dataset` type annotations left, only `DatasetRecord`, `DatasetItem`, `DatasetItemVersion`, `DatasetVersion`)
- [ ] `pnpm build:core` passes
- [ ] `pnpm build` passes (libsql, client-js, playground-ui all compile)

**1b. Extend experiment types**

Files:

- `packages/core/src/datasets/experiment/types.ts`

Add:

- `DataItem<I = unknown, E = unknown>` — `{ id?, input: I, groundTruth?: E, metadata? }`
- `ExperimentConfig<I, O, E>` — add generics, optional `datasetId`, `data`, `task`, `name`
- `StartExperimentConfig<I, O, E>` — `Omit<ExperimentConfig<I, O, E>, 'datasetId' | 'data' | 'experimentId'>`
- `task` return type: `O | Promise<O>`

Completion criteria:

- [ ] `DataItem`, `ExperimentConfig`, `StartExperimentConfig` all importable from `experiment/types.ts`
- [ ] `ExperimentConfig.datasetId` is optional (`string | undefined`)
- [ ] `ExperimentConfig.task` accepts sync or async functions
- [ ] `pnpm build:core` passes
- [ ] Existing `runExperiment()` callers see no type errors (all new fields optional, generics default to `unknown`)

---

### Phase 2 — Core Engine (sequential)

Single task. Depends on Phase 1b.

**2. Refactor `runExperiment()`**

Files:

- `packages/core/src/datasets/experiment/index.ts`

Changes:

- Item resolution phase: `config.data` (array or factory) → items, fallback to `config.datasetId` → storage fetch
- Task resolution phase: `config.task` → inline fn, fallback to `resolveTarget()` + `executeTarget()`
- p-map loop calls resolved `execFn`
- Task errors isolated per item: `{ output: null, error: message }`
- Scorer errors isolated per scorer: `{ score: null, error: message }`

Completion criteria:

- [ ] `runExperiment(mastra, { datasetId, targetType, targetId, scorers })` still works (backward compat)
- [ ] `runExperiment(mastra, { data: [...], task: fn, scorers })` works (inline path)
- [ ] `runExperiment(mastra, { data: async () => [...], task: fn, scorers })` works (factory path)
- [ ] Missing data source → throws `Error('No data source: provide datasetId or data')`
- [ ] Missing task source → throws `Error('No task: provide targetType+targetId or task')`
- [ ] Task error for one item does not fail entire experiment
- [ ] Scorer error for one scorer does not affect other scorers
- [ ] `pnpm build:core` passes

---

### Phase 3 — Public API (parallel: 3a ‖ 3b)

Two independent classes. Both depend on Phase 2.

**3a. `Dataset` class**

Files:

- `packages/core/src/datasets/dataset.ts` (NEW)

Constructor: `(id: string, storage: MastraCompositeStore, mastra: Mastra)`

Methods: `getDetails()`, `update()`, `addItem()`, `addItems()`, `getItem()`, `listItems()`, `updateItem()`, `deleteItem()`, `deleteItems()`, `listVersions()`, `listItemVersions()`, `startExperiment()`, `startExperimentAsync()`, `listExperiments()`, `getExperiment()`, `listExperimentResults()`, `deleteExperiment()`

Notes:

- Import `isZodType` from `@mastra/schema-compat` and `zodToJsonSchema` from `@mastra/schema-compat/zod-to-json` for `update()` Zod schema conversion.
- Lazy `#getDatasetsStore()` / `#getRunsStore()` — resolve on first call, cache, throw `MastraError` if missing
- `startExperiment<I, O, E>(config: StartExperimentConfig<I, O, E>)` injects `datasetId` and delegates to internal `runExperiment()`
- `startExperimentAsync(config)` creates run record, spawns background, returns `{ experimentId, status: 'pending' }`

Completion criteria:

- [ ] `new Dataset(id, storage, mastra)` does NOT call storage (no eager access)
- [ ] `ds.getDetails()` returns dataset metadata
- [ ] `ds.addItem({ input, groundTruth?, metadata? })` validates against schema if present
- [ ] `ds.startExperiment({ task, scorers })` injects `datasetId` automatically
- [ ] `ds.startExperimentAsync(config)` returns `{ experimentId, status: 'pending' }` immediately
- [ ] `ds.update({ inputSchema: z.object({...}) })` converts Zod to JSON Schema internally
- [ ] All object parameters (no positional string args)
- [ ] `pnpm build:core` passes

**3b. `DatasetsManager` class**

Files:

- `packages/core/src/datasets/manager.ts` (NEW)

Constructor: `(mastra: Mastra)`

Methods: `create()`, `get()`, `list()`, `delete()`, `getExperiment()`, `compareExperiments()`

Notes:

- Import `isZodType` from `@mastra/schema-compat` and `zodToJsonSchema` from `@mastra/schema-compat/zod-to-json` for `create()` Zod schema conversion.
- Lazy `#getDatasetsStore()` / `#getRunsStore()` — same pattern as `Dataset`
- `create()` returns a `Dataset` instance
- `get({ id })` throws `MastraError` if not found
- `compareExperiments({ experimentIds, baselineId? })` — MVP: returns `{ baselineId, items }`

Completion criteria:

- [ ] `new DatasetsManager(mastra)` does NOT call storage (no eager access)
- [ ] First method call with no storage → throws `MastraError` (domain: `STORAGE`, category: `USER`)
- [ ] `mgr.create({ name, inputSchema: z.object({...}) })` converts Zod to JSON Schema
- [ ] `mgr.create()` returns a `Dataset` instance with `.id`
- [ ] `mgr.get({ id })` returns `Dataset` instance, throws on not found
- [ ] `mgr.list()` returns `{ datasets, pagination }`
- [ ] `mgr.compareExperiments({ experimentIds: [a, b] })` returns `{ baselineId, items }`
- [ ] `pnpm build:core` passes

---

### Phase 4 — Wiring (parallel: 4a ‖ 4b ‖ 4c)

Three export/registration changes. Depend on Phase 3.

**4a. Barrel exports**

Files:

- `packages/core/src/datasets/index.ts`

Exports: `DatasetsManager`, `Dataset`, `StartExperimentConfig` (type)
Does NOT export: `DataItem`, `ExperimentConfig`

Completion criteria:

- [ ] `import { DatasetsManager, Dataset } from '../datasets'` works inside core
- [ ] `import type { StartExperimentConfig } from '../datasets'` works inside core
- [ ] `DataItem` and `ExperimentConfig` are not importable from `../datasets`

**4b. Mastra getter**

Files:

- `packages/core/src/mastra/index.ts`

Add: private `#datasets?: DatasetsManager` field, lazy `get datasets(): DatasetsManager` getter

Completion criteria:

- [ ] `mastra.datasets` returns a `DatasetsManager` instance
- [ ] Repeated access returns the same instance
- [ ] No storage check in getter (deferred to first method call)

**4c. Root re-exports**

Files:

- `packages/core/src/index.ts`

Add: `export { DatasetsManager, Dataset } from './datasets'` and `export type { StartExperimentConfig } from './datasets'`

Completion criteria:

- [ ] `import { DatasetsManager, Dataset } from '@mastra/core'` resolves
- [ ] `import type { StartExperimentConfig } from '@mastra/core'` resolves
- [ ] `pnpm build:core` passes

---

### Phase 5 — Tests (parallel: 5a ‖ 5b ‖ 5c)

Three test files. Depend on Phase 4.

**5a. `manager.test.ts`**

File: `packages/core/src/datasets/__tests__/manager.test.ts` (NEW)

Test categories:

1. Construction — stores Mastra ref, no eager storage access
2. Storage not configured — throws `MastraError` on first method call
3. Dataset CRUD — `create()` returns `Dataset`, `get()` throws on missing
4. `list()` — pagination, empty case
5. `delete()` — delegation
6. Cross-dataset ops — `getExperiment()` null for missing, `compareExperiments()` delegation
7. Lazy resolution caching — `getStore()` called once across multiple calls
8. `mastra.datasets` getter — returns same instance

Completion criteria:

- [ ] All tests pass via `pnpm test:core`
- [ ] `MastraError` assertions verify `domain` and `category` fields

**5b. `dataset.test.ts`**

File: `packages/core/src/datasets/__tests__/dataset.test.ts` (NEW)

Test categories:

1. Item CRUD — `addItem()`, `addItems()`, `getItem()`, `listItems()`, `updateItem()`, `deleteItem()`, `deleteItems()`
2. Versioning — `listVersions()`, `listItemVersions()`, `listItems({ version })`, `getItem({ itemId, version })`
3. Experiments — `startExperiment()` delegates with correct `datasetId`, `startExperimentAsync()` returns `{ experimentId, status: 'pending' }`
4. Experiment reads — `listExperiments()`, `getExperiment()`, `listExperimentResults()`, `deleteExperiment()`
5. Stale dataset — `getDetails()` throws if dataset deleted
6. Schema validation — `addItem()` throws `SchemaValidationError`, `update()` throws `SchemaUpdateValidationError`
7. Pagination — opts forwarding for all list methods

Completion criteria:

- [ ] All tests pass via `pnpm test:core`
- [ ] Schema validation errors are correctly typed (`SchemaValidationError`, `SchemaUpdateValidationError`)

**5c. `experiment.test.ts`**

File: `packages/core/src/datasets/__tests__/experiment.test.ts` (NEW)

Test categories:

1. Inline task via dataset — `ds.startExperiment({ task, scorers })`, types flow, results persisted
2. Factory function data source — `ds.startExperiment({ data: async () => [...], task, scorers })`
3. Scorer error isolation — one failing scorer doesn't affect others
4. Task error isolation — one failing item doesn't fail experiment
5. Result persistence — results always persisted, tracing active
6. Backward compat — existing `{ targetType, targetId }` calls via dataset still work

Completion criteria:

- [ ] All tests pass via `pnpm test:core`
- [ ] Generic type params verified in at least one typed test (`ds.startExperiment<QA, Answer>()`)
- [ ] Error isolation tests verify other items/scorers still have valid results

---

### Phase 6 — Server Migration (single task)

Depends on Phase 4. Can run in parallel with Phase 5.

**6. Refactor server handlers**

Files:

- `packages/server/src/server/handlers/datasets.ts`

Changes:

- All 20+ handlers use `mastra.datasets` or `ds.someMethod()`
- Remove all `getStore('datasets')` and `getStore('runs')` calls
- Remove storage-not-configured guards (manager handles this)
- Keep `SchemaValidationError`/`SchemaUpdateValidationError` catches
- Keep `handleError` wrappers
- `TRIGGER_EXPERIMENT` → `ds.startExperimentAsync(config)`
- `COMPARE_EXPERIMENTS` → `mgr.compareExperiments({ experimentIds, baselineId? })`

Completion criteria:

- [ ] `grep "getStore('datasets')" packages/server/` → zero matches
- [ ] `grep "getStore('runs')" packages/server/src/server/handlers/datasets.ts` → zero matches
- [ ] No `if (!datasetsStore)` guards remain in handler file
- [ ] `pnpm build` passes (server package compiles)
- [ ] Single atomic commit for all handler changes

---

### Phase 7 — Final Verification (sequential)

Depends on all previous phases.

- [ ] `pnpm build:core` — compiles without errors
- [ ] `pnpm test:core` — existing + new tests pass
- [ ] `pnpm build` — full monorepo build succeeds
- [ ] `pnpm typecheck` — no new type errors
- [ ] `grep "getStore('datasets')" packages/server/` → zero matches
- [ ] `grep "getStore('runs')" packages/server/src/server/handlers/datasets.ts` → zero matches
- [ ] `import { DatasetsManager, Dataset } from '@mastra/core'` resolves
- [ ] Generic type params flow correctly in experiment tests
- [ ] No `DataItem` or `ExperimentConfig` importable from `@mastra/core`

---

## USAGE EXAMPLES

### Setup

```ts
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ url: 'file:local.db' }),
  agents: { weatherAgent },
  scorers: { helpfulness, accuracy },
});
```

### Create a dataset

Both `inputSchema` and `groundTruthSchema` accept either a JSON Schema object or a Zod schema. Zod schemas are automatically converted to JSON Schema internally.

**With Zod schemas:**

```ts
import { z } from 'zod';

const ds = await mastra.datasets.create({
  name: 'customer-support-qa',
  description: 'QA pairs for support agent evaluation',
  inputSchema: z.object({
    question: z.string(),
    customerTier: z.enum(['free', 'pro', 'enterprise']),
  }),
  groundTruthSchema: z.object({
    answer: z.string(),
  }),
});
console.log(ds.id); // "d_abc123"
```

**With JSON Schema (also supported):**

```ts
const ds = await mastra.datasets.create({
  name: 'customer-support-qa',
  description: 'QA pairs for support agent evaluation',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      customerTier: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
    },
    required: ['question'],
  },
  groundTruthSchema: {
    type: 'object',
    properties: { answer: { type: 'string' } },
    required: ['answer'],
  },
});
console.log(ds.id); // "d_abc123"
```

### Get an existing dataset

```ts
const ds = await mastra.datasets.get({ id: 'd_abc123' });
const details = await ds.getDetails();
console.log(details.name); // "customer-support-qa"
```

### List all datasets

```ts
const { datasets, pagination } = await mastra.datasets.list({
  pagination: { page: 0, perPage: 20 },
});
for (const d of datasets) {
  console.log(d.name, d.id);
}
```

### Delete a dataset

```ts
await mastra.datasets.delete({ id: 'd_abc123' });
```

### Update a dataset

`update()` also accepts Zod schemas for `inputSchema` and `groundTruthSchema`, just like `create()`.

```ts
const updated = await ds.update({
  description: 'Updated QA dataset for v2 support agent',
  metadata: { team: 'support', sprint: 42 },
});
```

```ts
// Updating schema with Zod
import { z } from 'zod';

const updated = await ds.update({
  inputSchema: z.object({
    question: z.string(),
    customerTier: z.enum(['free', 'pro', 'enterprise']),
    priority: z.number().optional(),
  }),
});
```

### Add a single item

```ts
const item = await ds.addItem({
  input: { question: 'How do I reset my password?', customerTier: 'pro' },
  groundTruth: { answer: 'Go to Settings > Security > Reset Password' },
  metadata: { source: 'zendesk-ticket-4521' },
});
console.log(item.id); // "di_xyz789"
```

### Bulk add items

```ts
const items = await ds.addItems({
  items: [
    { input: { question: 'How do I upgrade?' }, groundTruth: { answer: 'Visit billing page' } },
    { input: { question: 'What are the limits?' }, groundTruth: { answer: '100 req/min on free' } },
    { input: { question: 'Do you support SSO?' }, groundTruth: { answer: 'Yes, enterprise plan' } },
  ],
});
console.log(items.length); // 3
```

### List items

```ts
// Paginated
const { items, pagination } = await ds.listItems({ page: 0, perPage: 50 });
```

### Get / update / delete items

```ts
const item = await ds.getItem({ itemId: 'di_xyz789' }); // null if not found

const updated = await ds.updateItem({
  itemId: 'di_xyz789',
  groundTruth: { answer: 'Go to Settings > Account > Reset Password' },
});

await ds.deleteItem({ itemId: 'di_xyz789' });
await ds.deleteItems({ itemIds: ['di_abc456', 'di_def012'] });
```

### Versioning

```ts
// List dataset versions
const { versions } = await ds.listVersions();
for (const v of versions) {
  console.log(v.version, v.id);
}

// Get all items at a historical version
const { items: historicalItems } = await ds.listItems({ version: versions[1].version });

// List item version history
const { versions: itemVersions } = await ds.listItemVersions({ itemId: 'di_xyz789' });
for (const v of itemVersions) {
  console.log(v.versionNumber, v.snapshot, v.isDeleted);
}

// Get specific item version snapshot
const v2 = await ds.getItem({ itemId: 'di_xyz789', version: 2 });
console.log(v2?.snapshot);
```

### Start experiment — registry target (existing pattern)

```ts
const result = await ds.startExperiment({
  targetType: 'agent',
  targetId: 'weatherAgent',
  scorers: ['helpfulness', 'accuracy'],
  maxConcurrency: 5,
  itemTimeout: 30_000,
});

console.log(result.experimentId); // "exp_abc123"
console.log(result.status); // "completed"
console.log(result.succeededCount); // 48
console.log(result.failedCount); // 2

for (const item of result.results) {
  console.log(item.input, item.output, item.scores);
}
```

### Start experiment — inline task (new pattern)

```ts
// With explicit generics — input/output are typed
type QA = { question: string; customerTier: string };
type Answer = { answer: string };

const result = await ds.startExperiment<QA, Answer>({
  task: async ({ input, mastra, groundTruth }) => {
    // input is typed as QA, mastra gives access to agents/workflows
    const agent = mastra.getAgent('weatherAgent');
    const response = await agent.generate(input.question);
    return { answer: response.text }; // must match Answer
  },
  scorers: ['helpfulness', 'accuracy'],
  maxConcurrency: 5,
});
```

```ts
// Without generics — input is `unknown`, must narrow manually
const result = await ds.startExperiment({
  task: async ({ input, mastra }) => {
    const { question } = input as { question: string };
    const response = await mastra.getAgent('weatherAgent').generate(question);
    return { answer: response.text };
  },
  scorers: ['helpfulness'],
});
```

```ts
// Sync task — no async needed if your logic is synchronous
const result = await ds.startExperiment<{ x: number }, number>({
  task: ({ input }) => input.x * 2,
  scorers: ['accuracy'],
});
```

### Start experiment async (fire-and-forget)

```ts
const { experimentId, status } = await ds.startExperimentAsync({
  targetType: 'agent',
  targetId: 'weatherAgent',
  scorers: ['helpfulness'],
});

console.log(experimentId); // "exp_def456"
console.log(status); // "pending"

// Poll later
const run = await ds.getExperiment({ experimentId });
console.log(run?.status); // "running" | "completed" | "failed"
```

### List / get / delete experiments

```ts
const { runs, pagination } = await ds.listExperiments({ page: 0, perPage: 10 });
for (const run of runs) {
  console.log(run.id, run.status, run.targetType, run.targetId);
}

const run = await ds.getExperiment({ experimentId: 'exp_abc123' });
console.log(run?.status, run?.completedAt);

const { results } = await ds.listExperimentResults({ experimentId: 'exp_abc123', page: 0, perPage: 100 });
for (const r of results) {
  console.log(r.input, r.output, r.groundTruth, r.scores, r.traceId);
}

await ds.deleteExperiment({ experimentId: 'exp_abc123' });
```

### Compare experiments

```ts
const comparison = await mastra.datasets.compareExperiments({
  experimentIds: ['exp_abc123', 'exp_def456'],
  baselineId: 'exp_abc123', // optional, defaults to first
});

comparison.baselineId; // 'exp_abc123'

// Item-level detail — includes input, groundTruth, and per-experiment output + scores
for (const item of comparison.items) {
  console.log(item.itemId);
  console.log(item.input);
  console.log(item.groundTruth);

  // Results keyed by experimentId
  console.log(item.results);
  // {
  //   exp_abc123: { output: 'Click forgot password', scores: { accuracy: 0.6 } },
  //   exp_def456: { output: 'Go to Settings > Security', scores: { accuracy: 0.9 } },
  // }
}
```

> **N-way ready:** The input takes `experimentIds: string[]` (validated as `length >= 2`) and the result uses `Record<string, ...>` keyed by experimentId. When N-way comparison ships, the shape stays the same — just more keys in the records.
>
> **Deferred:** `warnings`, `diff` (version context, `itemsOnlyIn`, `itemsModified`), per-scorer aggregated stats (`scorers`). These can be added without breaking changes.

### Error cases

```ts
// No storage — getter is safe, first method call throws
const m = new Mastra({ agents: { myAgent } });
m.datasets; // OK — no throw
await m.datasets.list(); // throws: MastraError — storage not configured

// Not found
await mastra.datasets.get({ id: 'nonexistent' }); // throws: "Dataset not found"

// Schema validation
const ds = await mastra.datasets.create({
  name: 'typed',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
});
await ds.addItem({ input: { q: 123 } }); // throws SchemaValidationError

// Schema update breaks existing items
await ds.addItem({ input: { q: 'hello' } });
await ds.update({
  inputSchema: { type: 'object', properties: { q: { type: 'number' } }, required: ['q'] },
}); // throws SchemaUpdateValidationError
```

---

## RISKS

| Risk                                                          | Mitigation                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Phase 0 blast radius** — ~315 renames across 25+ files      | Pure rename, no logic changes. Run builds + tests after each task.                                              |
| **Stale `Dataset`** — dataset deleted after `get()`           | Acceptable — `Dataset` is a lightweight ref, subsequent ops throw from storage layer                            |
| **Async store resolution** — `getStore()` is async            | Cache after first call in both manager and `Dataset`                                                            |
| **Circular import** — `manager.ts` → `experiment/` → `Mastra` | Same circular already exists in experiment code; no new risk                                                    |
| **`startExperimentAsync` fire-and-forget**                    | Dedicated method creates run record, spawns background execution, returns `{ experimentId, status: 'pending' }` |
| **Server handler migration** — 20+ handlers change            | Do atomically in a single commit to avoid partial migration                                                     |

| **Backward compat** — existing `runExperiment()` callers | All new fields optional, generic defaults to `unknown`. Zero breaking changes. |

---

## VERIFICATION

1. `pnpm build:core` — compiles without errors
2. `pnpm test:core` — existing tests pass + new experiment/manager/dataset tests pass
3. `pnpm build` — full monorepo build succeeds (excludes examples/docs)
4. `grep getStore\('datasets'\)` in `packages/server/` — should return zero matches
5. `grep getStore\('runs'\)` in `packages/server/src/server/handlers/datasets.ts` — zero matches
6. `pnpm typecheck` — no new type errors
7. TypeScript verifies generic type params flow correctly in experiment tests
