# Phase 6 — Server Migration

> Single task. Depends on Phase 4 (barrel exports + `mastra.datasets` getter).
> Can run in parallel with Phase 5.
> **All handler changes should be in a single atomic commit.**

---

## Dependencies

- Phase 4 — `mastra.datasets` getter and barrel exports must be in place
- Phase 3 — `Dataset` class and `DatasetsManager` class must exist
- Phase 0 — field renames (`expectedOutput` → `groundTruth`, `context` → `metadata`, `outputSchema` → `groundTruthSchema`) must be complete in storage types

---

## Pre-existing State

### File: `packages/server/src/server/handlers/datasets.ts`

**20 route handlers**, each following the same pattern:

```ts
// CURRENT pattern (repeated 20 times):
const datasetsStore = await mastra.getStorage()?.getStore('datasets');
// some handlers also: const runsStore = await mastra.getStorage()?.getStore('runs');
if (!datasetsStore) {
  throw new HTTPException(500, { message: 'Storage not configured' });
}
// ... delegate to datasetsStore.someMethod(...)
```

**Current imports:**

```ts
import {
  runExperiment,
  compareExperiments,
  SchemaValidationError,
  SchemaUpdateValidationError,
} from '@mastra/core/datasets';
import type { StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
// ... schema imports from '../schemas/datasets'
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
```

### All 20 route constants (with line numbers):

| #   | Route Constant                  | Line | Method | Path                                                         | Storage Used    |
| --- | ------------------------------- | ---- | ------ | ------------------------------------------------------------ | --------------- |
| 1   | `LIST_DATASETS_ROUTE`           | 47   | GET    | `/datasets`                                                  | datasets        |
| 2   | `CREATE_DATASET_ROUTE`          | 82   | POST   | `/datasets`                                                  | datasets        |
| 3   | `GET_DATASET_ROUTE`             | 122  | GET    | `/datasets/:datasetId`                                       | datasets        |
| 4   | `UPDATE_DATASET_ROUTE`          | 152  | PATCH  | `/datasets/:datasetId`                                       | datasets        |
| 5   | `DELETE_DATASET_ROUTE`          | 212  | DELETE | `/datasets/:datasetId`                                       | datasets        |
| 6   | `LIST_ITEMS_ROUTE`              | 247  | GET    | `/datasets/:datasetId/items`                                 | datasets        |
| 7   | `ADD_ITEM_ROUTE`                | 293  | POST   | `/datasets/:datasetId/items`                                 | datasets        |
| 8   | `GET_ITEM_ROUTE`                | 337  | GET    | `/datasets/:datasetId/items/:itemId`                         | datasets        |
| 9   | `UPDATE_ITEM_ROUTE`             | 372  | PATCH  | `/datasets/:datasetId/items/:itemId`                         | datasets        |
| 10  | `DELETE_ITEM_ROUTE`             | 422  | DELETE | `/datasets/:datasetId/items/:itemId`                         | datasets        |
| 11  | `LIST_EXPERIMENTS_ROUTE`        | 463  | GET    | `/datasets/:datasetId/experiments`                           | runs            |
| 12  | `TRIGGER_EXPERIMENT_ROUTE`      | 505  | POST   | `/datasets/:datasetId/experiments`                           | datasets + runs |
| 13  | `GET_EXPERIMENT_ROUTE`          | 632  | GET    | `/datasets/:datasetId/experiments/:experimentId`             | datasets + runs |
| 14  | `LIST_EXPERIMENT_RESULTS_ROUTE` | 668  | GET    | `/datasets/:datasetId/experiments/:experimentId/results`     | datasets + runs |
| 15  | `COMPARE_EXPERIMENTS_ROUTE`     | 720  | POST   | `/datasets/:datasetId/compare`                               | datasets + runs |
| 16  | `LIST_DATASET_VERSIONS_ROUTE`   | 787  | GET    | `/datasets/:datasetId/versions`                              | datasets        |
| 17  | `LIST_ITEM_VERSIONS_ROUTE`      | 832  | GET    | `/datasets/:datasetId/items/:itemId/versions`                | datasets        |
| 18  | `GET_ITEM_VERSION_ROUTE`        | 884  | GET    | `/datasets/:datasetId/items/:itemId/versions/:versionNumber` | datasets        |
| 19  | `BULK_ADD_ITEMS_ROUTE`          | 929  | POST   | `/datasets/:datasetId/items/bulk`                            | datasets        |
| 20  | `BULK_DELETE_ITEMS_ROUTE`       | 982  | DELETE | `/datasets/:datasetId/items/bulk`                            | datasets        |

### File: `packages/server/src/server/schemas/datasets.ts`

Response schemas use **old field names** that Phase 0 renames:

- `outputSchema` (L65, L73, L122) → `groundTruthSchema`
- `expectedOutput` (L78, L84, L134, L174, L246, L309, L342) → `groundTruth`
- `context` (L79, L85, L135, L310, L343) → `metadata`
- `search` query param (L53) → remove (dropped from API)

Comparison response schema uses **old shape**:

- `runA` / `runB` (L215-222) → MVP only returns `baselineId` + `items`
- `versionMismatch`, `hasRegression`, `scorers`, `warnings` → remove from MVP

### File: `packages/server/src/server/server-adapter/routes/datasets.ts`

Route registration — **no changes needed** unless route constants are renamed.

### File: `packages/server/src/server/handlers/error.ts`

`handleError(error, message)` — extracts `status` from error and throws `HTTPException`. **No changes needed.**

### File: `packages/server/src/server/handlers/test-utils.ts`

```ts
export function createTestServerContext({ mastra }: { mastra: Mastra }): ServerContext {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}
```

### Existing test pattern (from `scores.test.ts`):

```ts
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { ROUTE_NAME } from './datasets';
import { createTestServerContext } from './test-utils';

let mockStorage: InMemoryStore;
let mastra: Mastra;

beforeEach(async () => {
  vi.clearAllMocks();
  mockStorage = new InMemoryStore();
  await mockStorage.init();
  mastra = new Mastra({ logger: false, storage: mockStorage });
});

// Invoke handler directly:
const result = await ROUTE_NAME.handler({
  ...createTestServerContext({ mastra }),
  datasetId: 'ds-1',
  page: 0,
  perPage: 10,
});
```

---

## Task 6a — Refactor handler imports

### AFTER imports:

```ts
import { SchemaValidationError, SchemaUpdateValidationError } from '@mastra/core/datasets';
import { HTTPException } from '../http-exception';
// ... schema imports unchanged
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';
```

**Removed:**

- `runExperiment` — no longer called directly; `ds.startExperimentAsync()` handles it
- `compareExperiments` — no longer called directly; `mgr.compareExperiments()` handles it
- `StoragePagination` — no longer needed; `Dataset` methods accept `{ page?, perPage? }`

---

## Task 6b — Refactor all 20 handlers

### Handler mapping table

| Handler                   | Before (storage calls)                                                        | After (public API)                                                                                |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `LIST_DATASETS`           | `datasetsStore.listDatasets({ pagination })`                                  | `mastra.datasets.list({ page, perPage })`                                                         |
| `CREATE_DATASET`          | `datasetsStore.createDataset({ name, ... })`                                  | `mastra.datasets.create({ name, ... })` → returns `Dataset` instance, call `.id` or return record |
| `GET_DATASET`             | `datasetsStore.getDatasetById({ id })`                                        | `mastra.datasets.get({ id })` → throws `MastraError` if not found                                 |
| `UPDATE_DATASET`          | `datasetsStore.updateDataset({ id, ... })`                                    | `ds.update({ name?, description?, ... })`                                                         |
| `DELETE_DATASET`          | `datasetsStore.deleteDataset({ id })`                                         | `mastra.datasets.delete({ id })`                                                                  |
| `LIST_ITEMS`              | `datasetsStore.listItems({ datasetId, pagination, version?, search? })`       | `ds.listItems({ version?, page?, perPage? })`                                                     |
| `ADD_ITEM`                | `datasetsStore.addItem({ datasetId, input, expectedOutput, context })`        | `ds.addItem({ input, groundTruth?, metadata? })`                                                  |
| `GET_ITEM`                | `datasetsStore.getItemById({ id })`                                           | `ds.getItem({ itemId })`                                                                          |
| `UPDATE_ITEM`             | `datasetsStore.updateItem({ id, datasetId, input, expectedOutput, context })` | `ds.updateItem({ itemId, input?, groundTruth?, metadata? })`                                      |
| `DELETE_ITEM`             | `datasetsStore.deleteItem({ id, datasetId })`                                 | `ds.deleteItem({ itemId })`                                                                       |
| `BULK_ADD_ITEMS`          | `datasetsStore.bulkAddItems({ datasetId, items })`                            | `ds.addItems({ items })`                                                                          |
| `BULK_DELETE_ITEMS`       | `datasetsStore.bulkDeleteItems({ datasetId, itemIds })`                       | `ds.deleteItems({ itemIds })`                                                                     |
| `LIST_DATASET_VERSIONS`   | `datasetsStore.listDatasetVersions({ datasetId, pagination })`                | `ds.listVersions({ page?, perPage? })`                                                            |
| `LIST_ITEM_VERSIONS`      | `datasetsStore.listItemVersions({ itemId, pagination })`                      | `ds.listItemVersions({ itemId, page?, perPage? })`                                                |
| `GET_ITEM_VERSION`        | `datasetsStore.getItemVersion(itemId, versionNumber)`                         | `ds.getItem({ itemId, version: versionNumber })`                                                  |
| `LIST_EXPERIMENTS`        | `runsStore.listRuns({ datasetId, pagination })`                               | `ds.listExperiments({ page?, perPage? })`                                                         |
| `TRIGGER_EXPERIMENT`      | manual `runId` gen + `createRun()` + fire-and-forget `runExperiment()`        | `ds.startExperimentAsync({ targetType, targetId, scorers?, version?, maxConcurrency? })`          |
| `GET_EXPERIMENT`          | `runsStore.getRunById({ id })`                                                | `ds.getExperiment({ experimentId })`                                                              |
| `LIST_EXPERIMENT_RESULTS` | `runsStore.listResults({ runId, pagination })`                                | `ds.listExperimentResults({ experimentId, page?, perPage? })`                                     |
| `COMPARE_EXPERIMENTS`     | `compareExperiments(mastra, { runIdA, runIdB, thresholds })`                  | `mastra.datasets.compareExperiments({ experimentIds: [idA, idB], baselineId? })`                  |

### Key transformation notes

#### Storage guard removal

All 20 handlers currently have:

```ts
const datasetsStore = await mastra.getStorage()?.getStore('datasets');
if (!datasetsStore) {
  throw new HTTPException(500, { message: 'Storage not configured' });
}
```

**Remove all of these.** `DatasetsManager` and `Dataset` throw `MastraError` (domain: `STORAGE`, category: `USER`) on first storage access if not configured. The `handleError` wrapper will catch `MastraError` and convert to `HTTPException`.

However, note that `MastraError` has no `.status` property. `handleError` uses `error.status || error.details?.status || 500` to determine HTTP status. A `MastraError` will default to 500, which matches the current behavior (storage-not-configured → 500).

#### Dataset existence checks

Many handlers currently do:

```ts
const dataset = await datasetsStore.getDatasetById({ id: datasetId });
if (!dataset) {
  throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
}
```

**`DatasetsManager.get({ id })` throws `MastraError` with `id: 'DATASET_NOT_FOUND'` if not found.** The `handleError` wrapper will convert this to a 500 (since `MastraError` has no HTTP status). You need to either:

1. Catch `MastraError` and rethrow as `HTTPException(404)`, OR
2. Keep the dataset existence check in handlers that need a 404

**Recommendation:** Catch `MastraError` with `id === 'DATASET_NOT_FOUND'` and rethrow as `HTTPException(404)`.

```ts
try {
  const ds = await mastra.datasets.get({ id: datasetId });
  // ...
} catch (error) {
  if (error instanceof MastraError && error.id === 'DATASET_NOT_FOUND') {
    throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
  }
  throw error;
}
```

#### TRIGGER_EXPERIMENT handler (most complex)

**Before** (L505-629):

1. Fetches `datasetsStore` and `runsStore`
2. Fetches dataset, items (by version or latest)
3. Generates `runId` via `crypto.randomUUID()`
4. Creates `pending` run via `runsStore.createRun()`
5. Spawns `runExperiment()` in fire-and-forget with error logging
6. Returns `{ experimentId: runId, status: 'pending', ... }`

**After:**

```ts
const ds = await mastra.datasets.get({ id: datasetId });
const result = await ds.startExperimentAsync({
  targetType,
  targetId,
  scorers: scorerIds,
  version,
  maxConcurrency,
});
return result; // { experimentId, status: 'pending' }
```

`startExperimentAsync` encapsulates all of: run record creation, fire-and-forget execution, and immediate return.

#### COMPARE_EXPERIMENTS handler

**Before** (L720-781):

1. Fetches `datasetsStore` and `runsStore`
2. Validates dataset exists
3. Validates both experiments exist via `runsStore.getRunById()`
4. Calls `compareExperiments(mastra, { runIdA, runIdB, thresholds })`
5. Adds warning if experiments belong to different datasets
6. Returns full `ComparisonResult` (with `runA`, `runB`, `versionMismatch`, `hasRegression`, `scorers`, `items`, `warnings`)

**After:**

```ts
const result = await mastra.datasets.compareExperiments({
  experimentIds: [experimentIdA, experimentIdB],
  baselineId: experimentIdA,
});
return result; // MVP: { baselineId, items }
```

**NOTE:** The response shape changes significantly. The MVP `compareExperiments` returns only `{ baselineId, items }` (no `runA`/`runB`, `scorers`, `hasRegression`, etc.). The `comparisonResponseSchema` in schemas file **must be updated** to match.

#### LIST_EXPERIMENT_RESULTS handler

**Before:** Maps `runId` to `experimentId` in results:

```ts
const result = await runsStore.listResults({ runId: experimentId, pagination });
return {
  results: result.results.map(({ runId: experimentId, ...rest }) => ({ experimentId, ...rest })),
  pagination: result.pagination,
};
```

**After:**

```ts
const ds = await mastra.datasets.get({ id: datasetId });
const result = await ds.listExperimentResults({ experimentId, page, perPage });
return result; // Dataset class handles runId → experimentId mapping
```

#### LIST_ITEMS handler — `search` parameter

Current handler passes `search` to `datasetsStore.listItems()`. The plan dropped `search` from the public API. Options:

1. Drop `search` from `listItemsQuerySchema` and handler
2. Keep `search` pass-through at server level only

**Recommendation:** Drop `search` from `listItemsQuerySchema` (consistent with plan). If needed later, add it back.

#### GET_ITEM handler — ownership check

Current handler verifies `item.datasetId === datasetId` after fetching. Since `Dataset.getItem({ itemId })` delegates to storage without a dataset ownership check, the handler should either:

1. Trust the `Dataset` class to scope by dataset (if it passes `datasetId` to storage), OR
2. Keep the ownership check

**Check Phase 3:** `Dataset.getItem({ itemId })` calls `store.getItemById({ id: itemId })` — this does NOT filter by `datasetId`. The handler should keep the ownership check:

```ts
const item = await ds.getItem({ itemId });
if (item.datasetId !== datasetId) {
  throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
}
```

**Or better:** Phase 3 `Dataset.getItem()` should validate `item.datasetId === this.#id` and throw if mismatch. If it does, the handler can skip this check.

---

## Task 6c — Update response schemas

### File: `packages/server/src/server/schemas/datasets.ts`

| Schema                            | Field change                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createDatasetBodySchema`         | `outputSchema` → `groundTruthSchema`                                                                 |
| `updateDatasetBodySchema`         | `outputSchema` → `groundTruthSchema`                                                                 |
| `addItemBodySchema`               | `expectedOutput` → `groundTruth`, `context` → `metadata`                                             |
| `updateItemBodySchema`            | `expectedOutput` → `groundTruth`, `context` → `metadata`                                             |
| `datasetResponseSchema`           | `outputSchema` → `groundTruthSchema`                                                                 |
| `datasetItemResponseSchema`       | `expectedOutput` → `groundTruth`, `context` → `metadata`                                             |
| `experimentResultResponseSchema`  | `expectedOutput` → `groundTruth`                                                                     |
| `experimentSummaryResponseSchema` | `expectedOutput` → `groundTruth` (in results array)                                                  |
| `itemVersionResponseSchema`       | snapshot: `expectedOutput` → `groundTruth`, `context` → `metadata`                                   |
| `bulkAddItemsBodySchema`          | items: `expectedOutput` → `groundTruth`, `context` → `metadata`                                      |
| `listItemsQuerySchema`            | remove `search` field                                                                                |
| `comparisonResponseSchema`        | **replace entirely** with MVP shape: `{ baselineId, items }`                                         |
| `itemComparisonSchema`            | **replace** with `{ itemId, input, groundTruth, results: Record<experimentId, { output, scores }> }` |
| Remove `scorerStatsSchema`        | no longer used in MVP                                                                                |
| Remove `scorerComparisonSchema`   | no longer used in MVP                                                                                |

---

## Tests

### File: `packages/server/src/server/handlers/datasets.test.ts` (NEW)

Uses the same test pattern as `scores.test.ts`:

- Real `InMemoryStore` for storage
- Real `Mastra` instance with `storage: mockStorage`
- Direct handler invocation via `ROUTE_NAME.handler({ ...createTestServerContext({ mastra }), ... })`
- `HTTPException` assertions for error cases

### Setup

```ts
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  LIST_DATASETS_ROUTE,
  CREATE_DATASET_ROUTE,
  GET_DATASET_ROUTE,
  UPDATE_DATASET_ROUTE,
  DELETE_DATASET_ROUTE,
  LIST_ITEMS_ROUTE,
  ADD_ITEM_ROUTE,
  GET_ITEM_ROUTE,
  UPDATE_ITEM_ROUTE,
  DELETE_ITEM_ROUTE,
  LIST_EXPERIMENTS_ROUTE,
  TRIGGER_EXPERIMENT_ROUTE,
  GET_EXPERIMENT_ROUTE,
  LIST_EXPERIMENT_RESULTS_ROUTE,
  COMPARE_EXPERIMENTS_ROUTE,
  LIST_DATASET_VERSIONS_ROUTE,
  LIST_ITEM_VERSIONS_ROUTE,
  GET_ITEM_VERSION_ROUTE,
  BULK_ADD_ITEMS_ROUTE,
  BULK_DELETE_ITEMS_ROUTE,
} from './datasets';
import { createTestServerContext } from './test-utils';

let mockStorage: InMemoryStore;
let mastra: Mastra;

beforeEach(async () => {
  vi.clearAllMocks();
  mockStorage = new InMemoryStore();
  await mockStorage.init();
  mastra = new Mastra({ logger: false, storage: mockStorage });
});
```

### Test categories

#### A. Verify `mastra.datasets` is used (no direct `getStore` calls)

These tests verify the migration is correct by confirming handlers go through the public API.

**Test 1:** `LIST_DATASETS_ROUTE` returns datasets via `mastra.datasets.list()`

```
- Create 2 datasets via storage directly
- Call handler with { page: 0, perPage: 10 }
- Assert result.datasets has 2 entries
- Assert result.pagination exists
```

**Test 2:** `CREATE_DATASET_ROUTE` creates via `mastra.datasets.create()`

```
- Call handler with { name: 'test', description: 'desc' }
- Assert result has id, name, description
- Verify dataset exists in storage
```

**Test 3:** `GET_DATASET_ROUTE` gets via `mastra.datasets.get()`

```
- Create dataset via storage
- Call handler with { datasetId: 'ds-1' }
- Assert result matches created dataset
```

**Test 4:** `GET_DATASET_ROUTE` returns 404 for non-existent dataset

```
- Call handler with { datasetId: 'nonexistent' }
- Assert throws HTTPException with status 404
```

**Test 5:** `DELETE_DATASET_ROUTE` deletes via `mastra.datasets.delete()`

```
- Create dataset, call handler with { datasetId }
- Assert success
- Verify dataset no longer exists
```

#### B. Item CRUD through `Dataset` class

**Test 6:** `ADD_ITEM_ROUTE` adds item via `ds.addItem()`

```
- Create dataset
- Call handler with { datasetId, input: { q: 'hello' }, groundTruth: 'world', metadata: { src: 'test' } }
- Assert result has id, input, groundTruth, metadata
```

**Test 7:** `ADD_ITEM_ROUTE` with schema validation error returns 400

```
- Create dataset with inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] }
- Call handler with { input: { wrong: 123 } }
- Assert throws HTTPException with status 400
```

**Test 8:** `LIST_ITEMS_ROUTE` lists items via `ds.listItems()`

```
- Create dataset + 3 items
- Call handler with { datasetId, page: 0, perPage: 10 }
- Assert result.items has 3 entries
```

**Test 9:** `GET_ITEM_ROUTE` gets item via `ds.getItem()`

```
- Create dataset + item
- Call handler with { datasetId, itemId }
- Assert result matches
```

**Test 10:** `UPDATE_ITEM_ROUTE` updates item via `ds.updateItem()`

```
- Create dataset + item
- Call handler with { datasetId, itemId, input: { q: 'updated' } }
- Assert result reflects update
```

**Test 11:** `DELETE_ITEM_ROUTE` deletes item via `ds.deleteItem()`

```
- Create dataset + item
- Call handler
- Verify item no longer retrievable
```

#### C. Bulk operations

**Test 12:** `BULK_ADD_ITEMS_ROUTE` adds items via `ds.addItems()`

```
- Create dataset
- Call handler with { items: [{ input: 'a' }, { input: 'b' }] }
- Assert result.count === 2
```

**Test 13:** `BULK_DELETE_ITEMS_ROUTE` deletes items via `ds.deleteItems()`

```
- Create dataset + 2 items
- Call handler with { itemIds: [id1, id2] }
- Assert result.deletedCount === 2
```

#### D. Version operations

**Test 14:** `LIST_DATASET_VERSIONS_ROUTE` lists versions via `ds.listVersions()`

```
- Create dataset + add items (creates versions)
- Call handler
- Assert result.versions is non-empty
```

**Test 15:** `LIST_ITEM_VERSIONS_ROUTE` lists item versions via `ds.listItemVersions()`

```
- Create dataset + item + update item
- Call handler
- Assert result.versions.length >= 2
```

**Test 16:** `GET_ITEM_VERSION_ROUTE` gets version via `ds.getItem({ itemId, version })`

```
- Create dataset + item
- Call handler with { versionNumber: 1 }
- Assert result is the version snapshot
```

#### E. Experiment operations

**Test 17:** `TRIGGER_EXPERIMENT_ROUTE` triggers via `ds.startExperimentAsync()`

```
- Create dataset + items
- Register a mock agent on mastra
- Call handler with { targetType: 'agent', targetId: 'test-agent' }
- Assert result has experimentId and status: 'pending'
```

**Test 18:** `TRIGGER_EXPERIMENT_ROUTE` returns 404 for non-existent dataset

```
- Call handler with non-existent datasetId
- Assert throws HTTPException 404
```

**Test 19:** `LIST_EXPERIMENTS_ROUTE` lists via `ds.listExperiments()`

```
- Create dataset, trigger an experiment
- Call handler
- Assert result.experiments is non-empty
```

**Test 20:** `GET_EXPERIMENT_ROUTE` gets via `ds.getExperiment()`

```
- Create dataset, trigger experiment, get experimentId
- Call handler with { experimentId }
- Assert result matches
```

**Test 21:** `GET_EXPERIMENT_ROUTE` returns 404 for non-existent experiment

```
- Create dataset
- Call handler with { experimentId: 'nonexistent' }
- Assert throws HTTPException 404
```

**Test 22:** `LIST_EXPERIMENT_RESULTS_ROUTE` lists via `ds.listExperimentResults()`

```
- Create dataset, trigger experiment (wait for completion), list results
- Assert result.results is array, result.pagination exists
```

#### F. Compare experiments (MVP)

**Test 23:** `COMPARE_EXPERIMENTS_ROUTE` compares via `mastra.datasets.compareExperiments()`

```
- Create dataset + 2 experiments
- Call handler with { experimentIdA, experimentIdB }
- Assert result has baselineId and items array
- Assert result does NOT have runA, runB, hasRegression, scorers, warnings
```

#### G. No-storage error

**Test 24:** Handler throws when storage not configured

```
- Create Mastra without storage: new Mastra({ logger: false })
- Call LIST_DATASETS_ROUTE.handler(...)
- Assert throws (either HTTPException or MastraError)
```

### Test count: 24 tests

---

## Discrepancies & Risks

### 1. `MastraError` → `HTTPException` mapping

`handleError` extracts `.status` from errors. `MastraError` has no `.status` property — it defaults to 500.

For `DATASET_NOT_FOUND` and `EXPERIMENT_NOT_FOUND` errors, the current handlers return 404. After migration, `MastraError` will produce 500 unless handlers explicitly catch and rethrow as `HTTPException(404)`.

**Decision needed:** Either add status-code awareness to the `Dataset`/`DatasetsManager` error types, or catch `MastraError` in handlers.

### 2. Response schema field names must match

After Phase 0 renames, storage returns `groundTruth` and `metadata`. The Zod schemas in `datasets.ts` must be updated to match, otherwise response validation will fail or fields will be silently dropped.

### 3. `compareExperiments` response shape change

The MVP `compareExperiments` returns `{ baselineId, items }`. The current `comparisonResponseSchema` expects `{ runA, runB, versionMismatch, hasRegression, scorers, items, warnings }`. The schema **must** be updated or the handler will fail validation.

### 4. `TRIGGER_EXPERIMENT_ROUTE` simplification

Current handler does ~40 lines of manual orchestration (item fetching, run creation, fire-and-forget). After migration, it's ~3 lines via `ds.startExperimentAsync()`. The return shape must match `experimentSummaryResponseSchema`.

`startExperimentAsync` returns `{ experimentId, status: 'pending' }`. The current schema expects `{ experimentId, status, totalItems, succeededCount, failedCount, startedAt, completedAt, results }`. Either:

- `startExperimentAsync` must return the full shape, OR
- The schema must be simplified

**Check Phase 3:** `startExperimentAsync` return type. If it returns minimal `{ experimentId, status }`, the handler may need to construct the full response.

### 5. `search` parameter removal

`listItemsQuerySchema` currently has a `search` field. Removing it is a **breaking API change** for any clients using it. This is acceptable since datasets are not yet shipped.

### 6. Handler ownership validation for items

`GET_ITEM_ROUTE` and `GET_ITEM_VERSION_ROUTE` currently validate that the fetched item belongs to the dataset in the URL path. If `Dataset.getItem()` doesn't enforce this, the handler must keep the check.

### 7. `experimentResponseSchema` uses `id` not `experimentId`

The `experimentResponseSchema` (L141-155) has `id: z.string()` for the run's ID. After migration, `ds.getExperiment()` returns storage's `Run` type which also uses `id`. The handler should map `id` → `experimentId` if the schema changes, or keep `id` if the schema stays.

---

## Completion Criteria

- [ ] `grep "getStore('datasets')" packages/server/` → **zero matches**
- [ ] `grep "getStore('runs')" packages/server/src/server/handlers/datasets.ts` → **zero matches**
- [ ] `grep "runExperiment" packages/server/src/server/handlers/datasets.ts` → **zero matches** (no direct import/call)
- [ ] `grep "compareExperiments" packages/server/src/server/handlers/datasets.ts` → **zero matches** (no direct import/call)
- [ ] No `if (!datasetsStore)` guards remain in handler file
- [ ] No `if (!runsStore)` guards remain in handler file
- [ ] `grep "expectedOutput" packages/server/src/server/schemas/datasets.ts` → **zero matches**
- [ ] `grep "outputSchema" packages/server/src/server/schemas/datasets.ts` → **zero matches** (except possibly JSON Schema type helpers)
- [ ] `grep '"context"' packages/server/src/server/schemas/datasets.ts` → **zero matches** (as item field name)
- [ ] All 24 tests pass
- [ ] `pnpm build` passes (server package compiles)
- [ ] Single atomic commit for all handler + schema changes
