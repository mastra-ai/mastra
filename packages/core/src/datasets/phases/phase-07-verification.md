# Phase 7 — Final Verification

> Sequential. Depends on Phases 0–6 being complete.

---

## PURPOSE

Automated and manual checks to confirm every phase delivered correctly. Each check includes the exact command, expected output, and what a failure means. A sub-agent can execute this top-to-bottom.

---

## DEPENDENCIES

All of Phases 0–6 must be complete before running verification.

---

## PRE-EXISTING STATE (before Phase 0)

These are the values that exist in the codebase BEFORE any phases run. Phase 7 verifies they have all been transformed.

### Field names (old → new)

| Old                      | New                       | Where                                                                           |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------- |
| `expectedOutput`         | `groundTruth`             | storage types, constants, domains, handlers, schemas, client SDK, playground-ui |
| `context` (item field)   | `metadata`                | storage types, constants, domains, handlers, schemas, client SDK, playground-ui |
| `outputSchema` (dataset) | `groundTruthSchema`       | storage types, constants, schemas                                               |
| `runId` (experiment)     | `experimentId`            | experiment types, experiment engine, storage uses `id` internally               |
| `interface Dataset`      | `interface DatasetRecord` | `packages/core/src/storage/types.ts`                                            |

### Things that did NOT exist before

| What                                                   | Created in |
| ------------------------------------------------------ | ---------- |
| `DatasetsManager` class                                | Phase 3    |
| `Dataset` class                                        | Phase 3    |
| `StartExperimentConfig` type                           | Phase 1b   |
| `DataItem` type                                        | Phase 1b   |
| `mastra.datasets` getter                               | Phase 4    |
| `packages/core/src/datasets/__tests__/`                | Phase 5    |
| `packages/server/src/server/handlers/datasets.test.ts` | Phase 6    |

---

## SECTION A — BUILD

### A1. Core build

```bash
pnpm build:core
```

**Expected:** Exit 0, no errors.
**Failure means:** Phase 1–4 introduced a compile error.

### A2. Full monorepo build

```bash
pnpm build
```

**Expected:** Exit 0. All packages compile including `@mastra/server`, stores, client SDKs.
**Failure means:** Phase 0 renames broke a downstream consumer, or Phase 6 schema changes broke server build.

### A3. TypeScript typecheck

```bash
pnpm typecheck
```

**Expected:** Exit 0 across all packages.
**Failure means:** Type mismatch introduced by renames or new exports.

---

## SECTION B — TESTS

### B1. Core tests

```bash
cd packages/core && pnpm test
```

**Expected:** All tests pass, including:

- 4 existing experiment tests in `src/datasets/experiment/__tests__/`
- New `src/datasets/__tests__/manager.test.ts` (Phase 5a — 15 tests)
- New `src/datasets/__tests__/dataset.test.ts` (Phase 5b — 31 tests)
- New `src/datasets/__tests__/experiment.test.ts` (Phase 5c — 11 tests)
- Wiring tests in `src/datasets/__tests__/wiring.test.ts` (Phase 4 — 8 tests)

**Failure means:** Phase 2 engine changes broke backward compat, or Phase 3/5 public API tests have bugs.

### B2. Server tests

```bash
cd packages/server && pnpm test
```

**Expected:** All tests pass, including:

- New `src/server/handlers/datasets.test.ts` (Phase 6 — 24 tests)
- All existing handler tests (`scores.test.ts`, `agents.test.ts`, etc.) still pass

**Failure means:** Phase 6 handler refactor or schema changes broke something.

### B3. LibSQL store tests (if available)

```bash
cd stores/libsql && pnpm test
```

**Expected:** Pass. LibSQL dataset storage tests work with renamed columns.
**Failure means:** Phase 0 column renames missed a query or mapper in LibSQL.

---

## SECTION C — PHASE 0 RENAME VERIFICATION

These grep checks confirm the field renames are complete everywhere.

### C1. `expectedOutput` is gone from core

```bash
grep -r 'expectedOutput' packages/core/src/storage/ packages/core/src/datasets/ --include='*.ts' -l
```

**Expected:** Zero matches.
**Failure means:** Phase 0a missed a file. Check `storage/types.ts`, `storage/constants.ts`, `storage/domains/`, `datasets/experiment/`, `datasets/validation/`.

### C2. `expectedOutput` is gone from server

```bash
grep -r 'expectedOutput' packages/server/src/server/ --include='*.ts' -l
```

**Expected:** Zero matches.
**Failure means:** Phase 0a or Phase 6 missed a schema or handler field.

### C3. `expectedOutput` is gone from client SDK

```bash
grep -r 'expectedOutput' client-sdks/client-js/src/ --include='*.ts' -l
```

**Expected:** Zero matches.
**Failure means:** Phase 0a missed `client-sdks/client-js/src/types.ts` (14 Dataset-related types use `expectedOutput`).

### C4. `expectedOutput` is gone from playground-ui

```bash
grep -r 'expectedOutput' packages/playground-ui/src/domains/datasets/ --include='*.ts' --include='*.tsx' -l
```

**Expected:** Zero matches.
**Failure means:** Phase 0a missed playground-ui (31+ occurrences across validation, export, forms, dialogs).

### C5. `.context` as item field is gone from core

```bash
grep -rn '\.context' packages/core/src/storage/types.ts packages/core/src/storage/constants.ts packages/core/src/datasets/ --include='*.ts' | grep -v 'TaskContext\|RequestContext\|AbortContext\|context(' | head -20
```

**Expected:** Zero matches for dataset-item `.context` field. Any remaining `context` must be non-dataset-item (e.g., `RequestContext`, function params).
**Note:** This is a fuzzy check. Manual review may be needed to distinguish dataset-item `context` from other uses. The rename target is `metadata`.

### C6. `.context` as item field is gone from server schemas

```bash
grep -n 'context' packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches. All item `context` fields should now be `metadata`.

### C7. `.context` as item field is gone from client SDK

```bash
grep -n '  context' client-sdks/client-js/src/types.ts
```

**Expected:** Zero matches for dataset-item `context` fields. Other `context` uses (e.g., in non-dataset types) are fine.

### C8. `.context` as item field is gone from playground-ui

```bash
grep -rn '\.context' packages/playground-ui/src/domains/datasets/ --include='*.ts' --include='*.tsx' | head -20
```

**Expected:** Zero matches for dataset-item `.context` field (13 occurrences pre-Phase 0).

### C9. `outputSchema` renamed in dataset contexts

```bash
grep -n 'outputSchema' packages/core/src/storage/constants.ts packages/core/src/storage/types.ts packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches. All dataset `outputSchema` references should now be `groundTruthSchema`.

### C10. `outputSchema` NOT renamed in non-dataset schemas (false positive guard)

```bash
grep -n 'outputSchema' packages/server/src/server/schemas/workflows.ts packages/server/src/server/schemas/mcp.ts packages/server/src/server/schemas/agents.ts
```

**Expected:** Matches still present. These are NOT dataset-related and must NOT be renamed.
**Failure means:** Phase 0 over-renamed — broke unrelated schemas.

### C11. `groundTruth` exists in correct places

```bash
grep -c 'groundTruth' packages/core/src/storage/types.ts
```

**Expected:** ≥ 8 matches (in `DatasetItem`, `DatasetItemVersion`, `AddDatasetItemInput`, `UpdateDatasetItemInput`, `BulkAddItemsInput`, `RunResult`, `AddRunResultInput`, `CreateItemVersionInput`).

### C12. `groundTruthSchema` exists in dataset schema

```bash
grep -c 'groundTruthSchema' packages/core/src/storage/types.ts packages/core/src/storage/constants.ts
```

**Expected:** ≥ 1 match in `types.ts` (in `Dataset`/`DatasetRecord`, `CreateDatasetInput`, `UpdateDatasetInput`), ≥ 1 match in `constants.ts`.

### C13. `SchemaValidationError.field` uses new names

```bash
grep -n "field.*input.*groundTruth\|'input' | 'groundTruth'" packages/core/src/datasets/validation/errors.ts
```

**Expected:** ≥ 1 match. The field type should be `'input' | 'groundTruth'` (NOT `'input' | 'expectedOutput'`).

### C14. Storage column definitions use new names

```bash
grep -A2 'DATASET_ITEMS_SCHEMA\|RUN_RESULTS_SCHEMA' packages/core/src/storage/constants.ts | grep -E 'groundTruth|metadata'
```

**Expected:** `groundTruth` and `metadata` appear in `DATASET_ITEMS_SCHEMA`. `groundTruth` appears in `RUN_RESULTS_SCHEMA`.

---

## SECTION D — PHASE 1 TYPE VERIFICATION

### D1. `DatasetRecord` interface exists

```bash
grep -n 'interface DatasetRecord ' packages/core/src/storage/types.ts
```

**Expected:** 1 match (was `interface Dataset`).

### D2. Old `interface Dataset` is gone from storage types

```bash
grep -n 'interface Dataset ' packages/core/src/storage/types.ts
```

**Expected:** Zero matches.
**Note:** `interface Dataset` may appear in other files (e.g., client SDK). This check is scoped to `storage/types.ts`.

### D3. `DataItem` type exists

```bash
grep -n 'interface DataItem\|type DataItem' packages/core/src/datasets/experiment/types.ts
```

**Expected:** 1 match with fields `id?`, `input`, `groundTruth?`, `metadata?`.

### D4. `ExperimentConfig` has optional `datasetId`

```bash
grep -A5 'interface ExperimentConfig\|type ExperimentConfig' packages/core/src/datasets/experiment/types.ts | grep 'datasetId'
```

**Expected:** `datasetId?:` (optional).

### D5. `ExperimentConfig` has `task` callback

```bash
grep -A10 'interface ExperimentConfig\|type ExperimentConfig' packages/core/src/datasets/experiment/types.ts | grep 'task'
```

**Expected:** `task?:` with a function signature accepting `{ input, mastra, groundTruth?, metadata?, signal? }`.

### D6. `ExperimentConfig` uses `experimentId` not `runId`

```bash
grep -n 'runId' packages/core/src/datasets/experiment/types.ts
```

**Expected:** Zero matches. All should be `experimentId`.

### D7. `StartExperimentConfig` exists

```bash
grep -n 'StartExperimentConfig' packages/core/src/datasets/experiment/types.ts
```

**Expected:** 1+ matches. Should be `Omit<ExperimentConfig, 'datasetId' | 'data' | 'experimentId'>`.

### D8. `ExperimentSummary` uses `experimentId`

```bash
grep -n 'experimentId' packages/core/src/datasets/experiment/types.ts
```

**Expected:** ≥ 2 matches (in `ExperimentConfig` and `ExperimentSummary`).

### D9. `ItemResult` uses `groundTruth`

```bash
grep -n 'groundTruth' packages/core/src/datasets/experiment/types.ts
```

**Expected:** ≥ 1 match in `ItemResult` (was `expectedOutput`).

---

## SECTION E — PHASE 2 ENGINE VERIFICATION

### E1. Backward compatibility — existing experiment test files pass

```bash
cd packages/core && npx vitest run src/datasets/experiment/__tests__/runExperiment.test.ts src/datasets/experiment/__tests__/p0-regression.test.ts src/datasets/experiment/__tests__/p1-regression.test.ts src/datasets/experiment/__tests__/executor.test.ts --no-coverage
```

**Expected:** All 4 files pass.
**Failure means:** Phase 2 engine changes broke backward compat for `{ datasetId, targetType, targetId }` path.

### E2. `runExperiment` supports inline `data` and `task`

Verified by Phase 5c tests. If E1 passes and B1 passes, this is confirmed.

---

## SECTION F — PHASE 3 PUBLIC API VERIFICATION

### F1. `Dataset` class exists

```bash
grep -n 'class Dataset ' packages/core/src/datasets/dataset.ts
```

**Expected:** 1 match.

### F2. `DatasetsManager` class exists

```bash
grep -n 'class DatasetsManager ' packages/core/src/datasets/manager.ts
```

**Expected:** 1 match.

### F3. `Dataset` class methods

```bash
grep -n 'async \|startExperiment\|startExperimentAsync\|addItem\|getItem\|listItems\|updateItem\|deleteItem\|addItems\|deleteItems\|listVersions\|listItemVersions\|listExperiments\|getExperiment\|listExperimentResults\|deleteExperiment\|update\|getDetails' packages/core/src/datasets/dataset.ts | head -30
```

**Expected:** All methods present: `getDetails`, `update`, `addItem`, `addItems`, `getItem`, `listItems`, `updateItem`, `deleteItem`, `deleteItems`, `listVersions`, `listItemVersions`, `startExperiment`, `startExperimentAsync`, `listExperiments`, `getExperiment`, `listExperimentResults`, `deleteExperiment`.

### F4. `DatasetsManager` class methods

```bash
grep -n 'async \|create\|get\|list\|delete\|getExperiment\|compareExperiments' packages/core/src/datasets/manager.ts | head -15
```

**Expected:** Methods present: `create`, `get`, `list`, `delete`, `getExperiment`, `compareExperiments`.

### F5. `compareExperiments` returns MVP shape

```bash
grep -A5 'compareExperiments' packages/core/src/datasets/manager.ts | grep -E 'baselineId|items'
```

**Expected:** Return type includes `baselineId` and `items`. No `runA`, `runB`, `hasRegression`, `scorers`, `warnings`.

### F6. `MastraError` IDs used correctly

```bash
grep -n "id:.*'[A-Z_]*'" packages/core/src/datasets/manager.ts packages/core/src/datasets/dataset.ts
```

**Expected:** At least: `DATASET_NOT_FOUND`, `COMPARE_INVALID_INPUT`, `STORAGE_NOT_CONFIGURED` (or similar). All IDs are UPPERCASE.

### F7. `experimentId` ↔ `runId` translation in Dataset class

```bash
grep -n 'runId\|experimentId' packages/core/src/datasets/dataset.ts | head -20
```

**Expected:** `experimentId` in method signatures, `runId` when calling storage internally. Confirms the translation layer works.

### F8. Zod schema support

```bash
grep -n 'isZodType\|zodToJsonSchema' packages/core/src/datasets/manager.ts packages/core/src/datasets/dataset.ts
```

**Expected:** ≥ 1 match in `manager.ts` (for `create`), ≥ 1 match in `dataset.ts` (for `update`).

---

## SECTION G — PHASE 4 WIRING VERIFICATION

### G1. Barrel exports in `datasets/index.ts`

```bash
cat packages/core/src/datasets/index.ts
```

**Expected:** 5 lines:

```ts
export * from './experiment';
export * from './validation';
export { DatasetsManager } from './manager';
export { Dataset } from './dataset';
export type { StartExperimentConfig } from './experiment/types';
```

(Exact paths may use `.js` extensions depending on module resolution — bare specifiers are the convention)

### G2. `mastra.datasets` getter exists

```bash
grep -n 'get datasets\|#datasets' packages/core/src/mastra/index.ts
```

**Expected:** Private `#datasets` field and `get datasets()` getter returning `DatasetsManager`.

### G3. Root re-exports

```bash
grep -n 'DatasetsManager\|Dataset\|StartExperimentConfig' packages/core/src/index.ts
```

**Expected:** All 3 are re-exported (value exports for `DatasetsManager` and `Dataset`, type export for `StartExperimentConfig`).

### G4. `@mastra/core/datasets` subpath still works

```bash
# Verified by the build — if B1 and B2 pass, server imports from `@mastra/core/datasets` are resolved.
grep "from '@mastra/core/datasets'" packages/server/src/server/handlers/datasets.ts
```

**Expected:** Import exists and resolves (no build errors from A2).

### G5. `DataItem` and `ExperimentConfig` NOT importable from `@mastra/core`

```bash
grep -n 'DataItem\|ExperimentConfig' packages/core/src/index.ts
```

**Expected:** Zero matches. These are internal types, only available via `@mastra/core/datasets` through `export * from './experiment'`.

**Note:** `DataItem` and `ExperimentConfig` ARE importable from `@mastra/core/datasets` via the `export * from './experiment'` barrel. This is acceptable — they're internal-leaning but not harmful. The key constraint is they are NOT in `@mastra/core` root.

### G6. No circular dependency

```bash
# If A1 passes without warnings, no circular dep. But explicitly check:
grep -n "from.*mastra/index\|from.*mastra'" packages/core/src/datasets/manager.ts packages/core/src/datasets/dataset.ts
```

**Expected:** Imports from `../mastra` or similar, not circular. `Mastra` type may be imported as `import type { Mastra }`.

---

## SECTION H — PHASE 5 TEST VERIFICATION

### H1. Test files exist

```bash
ls -la packages/core/src/datasets/__tests__/
```

**Expected:** At least 4 files:

- `manager.test.ts` (~15 tests)
- `dataset.test.ts` (~31 tests)
- `experiment.test.ts` (~11 tests)
- `wiring.test.ts` (~8 tests)

### H2. Test count

```bash
cd packages/core && npx vitest run src/datasets/__tests__/ --reporter=verbose 2>&1 | tail -5
```

**Expected:** ~65 tests pass (15 + 31 + 11 + 8).

### H3. Existing experiment tests still pass

```bash
cd packages/core && npx vitest run src/datasets/experiment/__tests__/ --reporter=verbose 2>&1 | tail -5
```

**Expected:** All 4 existing test files pass unchanged (backward compat).

---

## SECTION I — PHASE 6 SERVER MIGRATION VERIFICATION

### I1. No direct storage calls in handlers

```bash
grep -n "getStore" packages/server/src/server/handlers/datasets.ts
```

**Expected:** Zero matches. All 21 `getStore('datasets')` and 5 `getStore('runs')` calls removed.

### I2. No storage guards in handlers

```bash
grep -n 'if (!datasetsStore)\|if (!runsStore)' packages/server/src/server/handlers/datasets.ts
```

**Expected:** Zero matches.

### I3. No direct `runExperiment` or `compareExperiments` imports

```bash
grep -n 'runExperiment\|compareExperiments' packages/server/src/server/handlers/datasets.ts | grep -v 'startExperiment\|mastra.datasets'
```

**Expected:** Zero matches for direct function imports. `startExperimentAsync` and `mastra.datasets.compareExperiments` are the new patterns.

### I4. `mastra.datasets` used in handlers

```bash
grep -c 'mastra.datasets' packages/server/src/server/handlers/datasets.ts
```

**Expected:** ≥ 5 matches (for `list`, `create`, `get`, `delete`, `compareExperiments`).

### I5. Schema field renames in server

```bash
grep -n 'expectedOutput\|outputSchema' packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches for `expectedOutput`. Zero matches for `outputSchema` (as dataset field — the `jsonSchemaField` type helper is okay if it's a generic utility).
**Note:** `outputSchema` in `workflows.ts`, `mcp.ts`, `agents.ts` must NOT be touched (checked in C10).

### I6. `context` as item field gone from server schemas

```bash
grep -n '  context:' packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches. All should be `metadata:`.

### I7. `search` parameter removed

```bash
grep -n 'search' packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches. The `search` param was dropped from `listItemsQuerySchema`.

### I8. Comparison response schema updated to MVP

```bash
grep -n 'runA\|runB\|hasRegression\|versionMismatch\|scorerStats\|scorerComparison' packages/server/src/server/schemas/datasets.ts
```

**Expected:** Zero matches. Old comparison schema shapes are removed.

### I9. New comparison schema has MVP fields

```bash
grep -n 'baselineId\|itemComparison' packages/server/src/server/schemas/datasets.ts
```

**Expected:** `baselineId` present in `comparisonResponseSchema`. `itemComparisonSchema` updated to include `input`, `groundTruth`, and per-experiment `output`/`scores`.

### I10. `TRIGGER_EXPERIMENT_ROUTE` return shape reconciled

The current `experimentSummaryResponseSchema` expects: `experimentId`, `status`, `totalItems`, `succeededCount`, `failedCount`, `startedAt`, `completedAt`, `results`.

But `ds.startExperimentAsync()` returns only `{ experimentId, status: 'pending' }`.

**Resolution options** (must be decided during Phase 6):

1. **Simplify schema** — `triggerExperimentResponseSchema` becomes `{ experimentId, status }` for the trigger endpoint only.
2. **Enrich return** — `startExperimentAsync()` returns the full pending shape (`totalItems`, `succeededCount: 0`, `failedCount: 0`, `startedAt`, `completedAt: null`, `results: []`).

```bash
grep -A15 'TRIGGER_EXPERIMENT_ROUTE' packages/server/src/server/handlers/datasets.ts | head -20
```

**Expected:** The response matches the declared `responseSchema`. If option 1, a new simplified response schema. If option 2, `startExperimentAsync` returns the enriched pending shape.

### I11. `experimentResponseSchema` ID field

```bash
grep -A5 'experimentResponseSchema' packages/server/src/server/schemas/datasets.ts | head -8
```

**Expected:** Check whether `id` was renamed to `experimentId` or kept as `id`. The handler must match whichever is chosen. Consistency with `GET_EXPERIMENT_ROUTE` response.

### I12. Item ownership check preserved

```bash
grep -n 'datasetId' packages/server/src/server/handlers/datasets.ts | grep -i 'item\|match\|owner'
```

**Expected:** `GET_ITEM_ROUTE` handler still validates `item.datasetId === datasetId` after calling `ds.getItem()`, because `Dataset.getItem()` does not filter by `datasetId` internally.

### I13. Server handler tests exist and pass

```bash
ls packages/server/src/server/handlers/datasets.test.ts && cd packages/server && npx vitest run src/server/handlers/datasets.test.ts --reporter=verbose 2>&1 | tail -5
```

**Expected:** File exists. 24 tests pass.

### I14. `MastraError` to `HTTPException` mapping

```bash
grep -n 'MastraError\|HTTPException.*404\|DATASET_NOT_FOUND\|EXPERIMENT_NOT_FOUND' packages/server/src/server/handlers/datasets.ts | head -10
```

**Expected:** Handlers catch `MastraError` with specific IDs and rethrow as `HTTPException(404)` for not-found cases. This is critical because `MastraError` lacks a `.status` property, and `handleError` would default to 500.

---

## SECTION J — CROSS-PACKAGE CONSISTENCY

### J1. Client SDK types updated

```bash
grep -n 'expectedOutput\|outputSchema\|  context:' client-sdks/client-js/src/types.ts | head -20
```

**Expected:** Zero matches for dataset-related old field names. The 14 Dataset-related types should use `groundTruth`, `groundTruthSchema`, `metadata`.

### J2. Playground UI updated

```bash
grep -rc 'expectedOutput' packages/playground-ui/src/domains/datasets/
```

**Expected:** Zero total matches (was 31+ files pre-Phase 0).

### J3. LibSQL store uses `DatasetRecord`

```bash
grep -n 'Dataset' stores/libsql/src/storage/domains/datasets/index.ts | head -5
```

**Expected:** Imports `DatasetRecord` (not `Dataset`) from `@mastra/core/storage`.

### J4. In-memory DB uses `DatasetRecord`

```bash
grep -n 'Dataset' packages/core/src/storage/domains/inmemory-db.ts | head -5
```

**Expected:** Uses `DatasetRecord` (not `Dataset`).

### J5. `bulkAddItemsBodySchema` uses new field names

```bash
grep -A10 'bulkAddItemsBodySchema' packages/server/src/server/schemas/datasets.ts | head -12
```

**Expected:** `groundTruth` and `metadata` (not `expectedOutput` and `context`).

### J6. `experimentSummaryResponseSchema` uses `groundTruth`

```bash
grep -A20 'experimentSummaryResponseSchema' packages/server/src/server/schemas/datasets.ts | grep -E 'groundTruth|expectedOutput'
```

**Expected:** `groundTruth` in results array (not `expectedOutput`).

### J7. `itemVersionResponseSchema` uses new field names

```bash
grep -A15 'itemVersionResponseSchema' packages/server/src/server/schemas/datasets.ts | grep -E 'groundTruth|metadata|expectedOutput|context'
```

**Expected:** `groundTruth` and `metadata` in snapshot (not `expectedOutput` and `context`).

---

## SECTION K — SMOKE TESTS (manual or scripted)

These can be run as a quick integration check with in-memory storage.

### K1. `mastra.datasets` singleton

```ts
const mastra = new Mastra({ storage: new InMemoryStore() });
const a = mastra.datasets;
const b = mastra.datasets;
assert(a === b); // same instance
assert(a instanceof DatasetsManager);
```

### K2. Dataset CRUD

```ts
const ds = await mastra.datasets.create({ name: 'test' });
assert(ds instanceof Dataset);
assert(ds.id); // has an ID

const fetched = await mastra.datasets.get({ id: ds.id });
assert(fetched instanceof Dataset);

await mastra.datasets.delete({ id: ds.id });
await expect(mastra.datasets.get({ id: ds.id })).rejects.toThrow(); // MastraError DATASET_NOT_FOUND
```

### K3. Item CRUD with new field names

```ts
const ds = await mastra.datasets.create({ name: 'test' });
const item = await ds.addItem({ input: { q: 'hello' }, groundTruth: 'world', metadata: { source: 'manual' } });
assert(item.groundTruth === 'world');
assert(item.metadata.source === 'manual');
// No `expectedOutput` or `context` fields
assert(!('expectedOutput' in item));
assert(!('context' in item));
```

### K4. Experiment end-to-end

```ts
const ds = await mastra.datasets.create({ name: 'eval-test' });
await ds.addItems({
  items: [
    { input: { q: 'What is 2+2?' }, groundTruth: '4' },
    { input: { q: 'What is 3+3?' }, groundTruth: '6' },
  ],
});

const summary = await ds.startExperiment({
  task: async ({ input, mastra: m }) => {
    assert(m === mastra); // mastra injected
    return input.q.length.toString();
  },
  scorers: [myScorer],
});

assert(summary.experimentId); // not `runId`
assert(summary.results.length === 2);
```

### K5. No-storage error

```ts
const mastra = new Mastra({ logger: false }); // no storage
try {
  await mastra.datasets.create({ name: 'fail' });
  assert(false, 'should have thrown');
} catch (err) {
  assert(err instanceof MastraError);
  assert(err.id === 'STORAGE_NOT_CONFIGURED');
}
```

---

## COMPLETION CRITERIA

All of the following must be true:

### Build

- [ ] `pnpm build:core` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm typecheck` exits 0

### Tests

- [ ] `pnpm test:core` — all pass (including ~65 new + ~existing)
- [ ] `cd packages/server && pnpm test` — all pass (including 24 new)
- [ ] 4 existing experiment test files pass unchanged

### Phase 0 — Renames

- [ ] Zero `expectedOutput` in core storage, datasets, server, client SDK, playground-ui
- [ ] Zero dataset-item `context` in core storage, datasets, server, client SDK, playground-ui
- [ ] Zero `outputSchema` in dataset-related types/constants/schemas
- [ ] `groundTruth`, `metadata`, `groundTruthSchema` exist in correct places
- [ ] `SchemaValidationError.field` type is `'input' | 'groundTruth'`
- [ ] Non-dataset `outputSchema` references (workflows, mcp, agents) are NOT renamed

### Phase 1 — Foundation

- [ ] `interface DatasetRecord` in `storage/types.ts` (not `interface Dataset`)
- [ ] `DataItem`, `ExperimentConfig`, `StartExperimentConfig` in `experiment/types.ts`
- [ ] `ExperimentConfig.datasetId` is optional
- [ ] `ExperimentConfig.experimentId` (not `runId`)
- [ ] `ExperimentConfig.task` callback with `{ input, mastra, groundTruth?, metadata?, signal? }`

### Phase 2 — Engine

- [ ] Backward compat: `{ datasetId, targetType, targetId }` path still works
- [ ] Inline `data` + `task` path works
- [ ] Factory function `data` works
- [ ] Error isolation: one item failure doesn't fail experiment

### Phase 3 — Public API

- [ ] `Dataset` and `DatasetsManager` classes exist with all planned methods
- [ ] `compareExperiments` returns `{ baselineId, items }` (MVP)
- [ ] `MastraError` IDs are UPPERCASE
- [ ] Zod schema support in `create()` and `update()`
- [ ] `experimentId` ↔ `runId` translation in Dataset class

### Phase 4 — Wiring

- [ ] `datasets/index.ts` exports `DatasetsManager`, `Dataset`, `StartExperimentConfig`
- [ ] `mastra.datasets` getter returns `DatasetsManager` singleton
- [ ] Root `index.ts` re-exports `DatasetsManager`, `Dataset`, `StartExperimentConfig`
- [ ] `DataItem`/`ExperimentConfig` NOT in root `index.ts`

### Phase 5 — Tests

- [ ] 4 test files in `datasets/__tests__/` with ~65 total tests
- [ ] Generic type params verified in at least one test
- [ ] `mastra` argument verified as same instance in task callback
- [ ] Scorer receives `groundTruth` (NOT `expectedOutput`)

### Phase 6 — Server Migration

- [ ] Zero `getStore('datasets')` or `getStore('runs')` in server handlers
- [ ] Zero storage guards in server handlers
- [ ] Zero `runExperiment`/`compareExperiments` direct imports in handler
- [ ] All schema field names updated
- [ ] Comparison response is MVP shape
- [ ] `TRIGGER_EXPERIMENT` return shape matches response schema
- [ ] `MastraError` → `HTTPException(404)` mapping for not-found cases
- [ ] 24 handler tests pass

### Cross-package

- [ ] Client SDK types use new field names
- [ ] Playground UI uses new field names
- [ ] LibSQL store uses `DatasetRecord`
- [ ] In-memory DB uses `DatasetRecord`

---

## KNOWN RISKS

1. **`TRIGGER_EXPERIMENT` return shape** — `startExperimentAsync()` returns `{ experimentId, status }` but current schema expects more fields. Must be reconciled in Phase 6. Verify in I10.

2. **`experimentResponseSchema` ID field** — Uses `id` not `experimentId`. Phase 6 must decide whether to rename. Verify in I11.

3. **`export * from './experiment'` leaks internals** — `DataItem`, `ExperimentConfig`, `runExperiment`, `executeTarget`, `resolveScorers`, `runScorersForItem`, analytics types all leak through `@mastra/core/datasets`. This is acceptable for now but is a tech debt item. Not a Phase 7 blocker.

4. **`context` field disambiguation** — Many non-dataset uses of `context` exist (React contexts, request contexts, etc.). Phase 0 rename only targets dataset-item `.context` → `.metadata`. Grep checks in C5/C6/C7/C8 need manual review to avoid false positives.

5. **DB migration not in scope** — Column renames in `constants.ts` define the schema shape but do NOT migrate existing data. Existing databases with `expectedOutput` and `context` columns will need a migration. This is deferred and NOT a Phase 7 blocker.

6. **`MastraError` lacks `.status`** — `handleError` in server extracts status from `error.status`. `MastraError` does not have this property, so all `MastraError` instances default to HTTP 500. Handlers must explicitly catch and rethrow as `HTTPException(404)` for not-found cases. Verify in I14.
