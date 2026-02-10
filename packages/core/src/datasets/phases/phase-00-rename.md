# Phase 0 — Field Renames

> Sequential. Must complete before Phase 1. Pure rename — no logic changes, no new features.

Three renames across the codebase:

| Old Name             | New Name            | Scope                              |
| -------------------- | ------------------- | ---------------------------------- |
| `expectedOutput`     | `groundTruth`       | Dataset items + run results        |
| item-level `context` | `metadata`          | Dataset items only                 |
| `outputSchema`       | `groundTruthSchema` | Dataset-level schema column + type |

---

## Dependencies

None — this is the first phase.

---

## Task 0a — Rename `expectedOutput` → `groundTruth`

~250+ references across 25+ files. The scorer bridge at `scorer.ts:110` already maps `item.expectedOutput` → `groundTruth` — after this rename that line becomes `groundTruth: item.groundTruth`.

### Files — Core Types

| File                                             | Lines                                      | What to change                                                                                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/types.ts`             | 916, 930, 966, 974, 1006, 1036, 1075, 1117 | Rename field in 8 interfaces: `DatasetItem`, `DatasetItemVersion.snapshot`, `AddDatasetItemInput`, `UpdateDatasetItemInput`, `CreateItemVersionInput.snapshot`, `BulkAddItemsInput.items[]`, `RunResult`, `AddRunResultInput` |
| `packages/core/src/datasets/experiment/types.ts` | 43                                         | Rename `ItemResult.expectedOutput` → `ItemResult.groundTruth`                                                                                                                                                                 |

### Files — Storage Schemas (DB columns)

| File                                     | Lines | What to change                                                             |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `packages/core/src/storage/constants.ts` | 215   | `DATASET_ITEMS_SCHEMA.expectedOutput` → `DATASET_ITEMS_SCHEMA.groundTruth` |
| `packages/core/src/storage/constants.ts` | 263   | `RUN_RESULTS_SCHEMA.expectedOutput` → `RUN_RESULTS_SCHEMA.groundTruth`     |

### Files — Storage Runtime (core)

| File                                                     | Lines                                      | What to change                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/domains/datasets/base.ts`     | 80, 122–123, 138, 170–171, 190, 229        | Rename all `.expectedOutput` refs in validation, addItem, updateItem, getItem                                              |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | 135, 170, 240, 252–260, 314, 447, 463, 507 | Rename all `.expectedOutput` refs in addItem, updateItem, getItemsAtVersion, listItems search, bulkAddItems, importDataset |
| `packages/core/src/storage/domains/runs/inmemory.ts`     | 120                                        | `expectedOutput` in addResult                                                                                              |

### Files — Storage Runtime (libsql)

| File                                                  | Lines                                                              | What to change                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `stores/libsql/src/storage/domains/datasets/index.ts` | 91, 347, 359, 415–417, 435, 596, 619–620, 706, 969, 981, 996, 1057 | Row mapping, addItem, updateItem (SQL SET), getItemsAtVersion, listItems search, bulkAddItems, importDataset |
| `stores/libsql/src/storage/domains/runs/index.ts`     | 82, 332, 351                                                       | Row mapping, addResult insert, addResult return                                                              |

### Files — Experiment Engine

| File                                              | Lines    | What to change                                                              |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `packages/core/src/datasets/experiment/index.ts`  | 179, 209 | `item.expectedOutput` → `item.groundTruth` in result building + persistence |
| `packages/core/src/datasets/experiment/scorer.ts` | 110      | `groundTruth: item.expectedOutput` → `groundTruth: item.groundTruth`        |

### Files — Validation

| File                                                 | Lines         | What to change                                                                               |
| ---------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `packages/core/src/datasets/validation/errors.ts`    | 14, 32, 43    | `'expectedOutput'` → `'groundTruth'` in field union types                                    |
| `packages/core/src/datasets/validation/validator.ts` | 37, 47, 77–84 | `'expectedOutput'` → `'groundTruth'` in validate/validateBulk field param + validation logic |

### Files — Server

| File                                              | Lines                                       | What to change                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/server/schemas/datasets.ts`  | 53, 65, 73, 78, 84, 134, 174, 246, 309, 342 | Rename `expectedOutput` in all Zod schemas (AddItemSchema, UpdateItemSchema, item response, run result response, version snapshot, bulk add) |
| `packages/server/src/server/handlers/datasets.ts` | 306–309, 323, 385–388, 408, 945             | Rename destructured `expectedOutput` in addItem, updateItem, bulkAddItems handlers                                                           |

### Files — Client SDK

| File                                  | Lines                              | What to change                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client-sdks/client-js/src/types.ts`  | 1437, 1478, 1515, 1523, 1531, 1571 | Rename in 6 interfaces: `DatasetItem`, `DatasetExperimentResult`, `AddDatasetItemParams`, `UpdateDatasetItemParams`, `BulkAddDatasetItemsParams.items[]`, `DatasetItemVersionResponse.snapshot` |
| `client-sdks/client-js/src/client.ts` | 1155                               | Inline type in experiment results response                                                                                                                                                      |

### Files — Playground UI

| File                                                                                             | Key Lines                                         | What to change                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------- |
| `packages/playground-ui/src/domains/datasets/utils/json-validation.ts`                           | 9, 99                                             | Type def + mapping              |
| `packages/playground-ui/src/domains/datasets/utils/csv-export.ts`                                | 6, 12                                             | CSV column name                 |
| `packages/playground-ui/src/domains/datasets/utils/csv-validation.ts`                            | 11, 36, 45, 74, 76, 80, 127–138                   | Column mapping type, validation |
| `packages/playground-ui/src/domains/datasets/utils/json-export.ts`                               | 10                                                | JSON export field               |
| `packages/playground-ui/src/domains/datasets/components/add-item-dialog.tsx`                     | 13, 64, 80–95, 126–166                            | Form state + submission         |
| `packages/playground-ui/src/domains/datasets/components/edit-item-dialog.tsx`                    | 18, 25–34, 48–64, 78, 98                          | Edit form state + submission    |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/item-detail-dialog.tsx`   | 47, 57, 94–121, 135, 196, 270, 274, 290, 302, 327 | View/edit item dialog           |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/item-detail-panel.tsx`    | 16, 77, 90, 126–153, 174, 190, 233                | Side panel view/edit            |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx`           | 20, 229, 256                                      | Column def + list rendering     |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-item-form.tsx`    | 10, 39, 52, 79, 84–85                             | Shared form component           |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-item-content.tsx` | 19, 25                                            | Read-only display               |
| `packages/playground-ui/src/domains/datasets/components/duplicate-dataset-dialog.tsx`            | 62, 73, 103                                       | Duplicate items                 |
| `packages/playground-ui/src/domains/datasets/components/csv-import/csv-import-dialog.tsx`        | 141–162, 213, 241, 266                            | CSV import mapping              |
| `packages/playground-ui/src/domains/datasets/components/csv-import/column-mapping-step.tsx`      | 15                                                | Column mapping option           |
| `packages/playground-ui/src/domains/datasets/components/json-import/json-import-dialog.tsx`      | 98                                                | JSON import                     |
| `packages/playground-ui/src/domains/datasets/components/json-import/json-preview-table.tsx`      | 43                                                | Preview table cell              |
| `packages/playground-ui/src/domains/datasets/components/json-import/json-upload-step.tsx`        | 134                                               | Example JSON                    |
| `packages/playground-ui/src/domains/datasets/components/add-items-to-dataset-dialog.tsx`         | 59                                                | Add items from results          |
| `packages/playground-ui/src/domains/datasets/components/create-dataset-from-items-dialog.tsx`    | 55                                                | Create dataset from items       |

### Files — Playground App Pages

| File                                                            | Lines                                          | What to change                                                     |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `packages/playground/src/pages/datasets/dataset/index.tsx`      | 139                                            | Edit item: passes `expectedOutput`                                 |
| `packages/playground/src/pages/datasets/dataset/item/index.tsx` | 59, 62–63, 75, 83, 131–135, 158, 173, 201, 323 | Item detail page: form state, parsing, submission, version display |

### Files — Tests

| File                                                                    | What to change                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| `packages/core/src/storage/domains/datasets/__tests__/datasets.test.ts` | ~20 refs — test data, assertions, test descriptions |
| `packages/core/src/storage/domains/runs/__tests__/runs.test.ts`         | ~6 refs — test data for run results                 |
| `packages/core/src/datasets/experiment/__tests__/executor.test.ts`      | ~13 refs — test data for item results               |
| `packages/core/src/datasets/experiment/__tests__/runExperiment.test.ts` | ~3 refs — test data for dataset items               |
| `packages/core/src/datasets/experiment/__tests__/p0-regression.test.ts` | ~2 refs — test data                                 |
| `packages/core/src/datasets/experiment/__tests__/p1-regression.test.ts` | ~1 ref — test data                                  |
| `stores/libsql/src/storage/domains/datasets/index.test.ts`              | ~10 refs — test data, assertions                    |

### Approach

1. Start from core types (`storage/types.ts`) — this propagates type errors to all consumers.
2. Fix `storage/constants.ts` (DB column schemas).
3. Fix storage runtime (core → libsql).
4. Fix experiment engine + validation.
5. Fix server schemas + handlers.
6. Fix client SDK.
7. Fix playground UI + app pages.
8. Fix all tests.
9. Use find-and-replace: `expectedOutput` → `groundTruth` (case-sensitive, whole-word).
10. **Do NOT rename** `item.expectedOutput` references inside scorer test mocks that test the _old_ API — wait, there are none. The scorer already uses `groundTruth`.

### Caution

- `expectedOutput` as a **string literal** in validation errors/types (`'expectedOutput'`) must also be renamed to `'groundTruth'`.
- The libsql SQL strings that reference `expectedOutput` as a column name must be renamed — this changes the DB column name.
- The `listItems` search in inmemory.ts (L252–260) filters on `expectedOutput` — rename the search target.

---

## Task 0b — Rename item-level `context` → `metadata`

~65 references across 20+ files. The UI already displays this field as "Metadata" in labels.

### Files — Core Types

| File                                 | Lines                          | What to change                                                                                                                                                                              |
| ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/types.ts` | 917, 931, 967, 975, 1007, 1037 | Rename field in 6 interfaces: `DatasetItem`, `DatasetItemVersion.snapshot`, `AddDatasetItemInput`, `UpdateDatasetItemInput`, `CreateItemVersionInput.snapshot`, `BulkAddItemsInput.items[]` |

### Files — Storage Schemas (DB columns)

| File                                     | Lines | What to change                                                   |
| ---------------------------------------- | ----- | ---------------------------------------------------------------- |
| `packages/core/src/storage/constants.ts` | 216   | `DATASET_ITEMS_SCHEMA.context` → `DATASET_ITEMS_SCHEMA.metadata` |

**Note:** `DATASET_ITEMS_SCHEMA` already has no `metadata` field — no collision.

### Files — Storage Runtime (core)

| File                                                     | Lines                             | What to change                                                                                  |
| -------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/domains/datasets/base.ts`     | 139, 191, 230                     | `.context` → `.metadata` in addItem, updateItem, getItem                                        |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | 136, 171, 241, 315, 448, 464, 508 | `.context` → `.metadata` in addItem, updateItem, getItemsAtVersion, bulkAddItems, importDataset |

### Files — Storage Runtime (libsql)

| File                                                  | Lines                                                     | What to change                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `stores/libsql/src/storage/domains/datasets/index.ts` | 92, 348, 360, 419–421, 436, 597, 707, 970, 982, 997, 1058 | Row mapping, addItem, updateItem (SQL SET), getItemsAtVersion, bulkAddItems, importDataset |

### Files — Experiment Engine

| File                                              | Lines | What to change                                                         |
| ------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| `packages/core/src/datasets/experiment/scorer.ts` | 64    | `additionalContext: item.context` → `additionalContext: item.metadata` |

### Files — Server

| File                                              | Lines                             | What to change                                                                                               |
| ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/server/src/server/schemas/datasets.ts`  | 79, 85, 135, 310, 343             | Rename `context` in Zod schemas (AddItemSchema, UpdateItemSchema, item response, version snapshot, bulk add) |
| `packages/server/src/server/handlers/datasets.ts` | 306, 309, 323, 385, 389, 408, 946 | Rename destructured `context` in handlers                                                                    |

### Files — Client SDK

| File                                 | Lines                        | What to change         |
| ------------------------------------ | ---------------------------- | ---------------------- |
| `client-sdks/client-js/src/types.ts` | 1438, 1516, 1524, 1532, 1572 | Rename in 5 interfaces |

### Files — Playground UI

| File                                                                                             | Key Lines         | What to change                                      |
| ------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------------------- |
| `packages/playground-ui/src/domains/datasets/utils/json-export.ts`                               | 11                | `context: item.context` → `metadata: item.metadata` |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/item-detail-dialog.tsx`   | 58, 122, 136, 234 | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/item-detail-panel.tsx`    | 91, 154, 175      | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx`           | 230               | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-item-content.tsx` | 20                | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/duplicate-dataset-dialog.tsx`            | 62, 74, 104       | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/csv-import/csv-import-dialog.tsx`        | 267               | Maps CSV → `context` becomes `metadata`             |
| `packages/playground-ui/src/domains/datasets/components/json-import/json-import-dialog.tsx`      | 99                | Maps JSON → `context` becomes `metadata`            |
| `packages/playground-ui/src/domains/datasets/components/add-items-to-dataset-dialog.tsx`         | 60                | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/components/create-dataset-from-items-dialog.tsx`    | 56                | `.context` → `.metadata`                            |
| `packages/playground-ui/src/domains/datasets/hooks/use-dataset-item-versions.ts`                 | 15                | Snapshot type `context?` → `metadata?`              |

### Files — Playground App Pages

| File                                                            | Lines        | What to change           |
| --------------------------------------------------------------- | ------------ | ------------------------ |
| `packages/playground/src/pages/datasets/dataset/item/index.tsx` | 65, 175, 202 | `.context` → `.metadata` |

### Files — Tests

| File                                                                    | What to change                                |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| `packages/core/src/storage/domains/datasets/__tests__/datasets.test.ts` | ~8 refs — test data, assertions, descriptions |
| `stores/libsql/src/storage/domains/datasets/index.test.ts`              | ~6 refs — test data, assertions               |

### Caution

- Only rename `context` that is clearly a **dataset item field**. Do NOT rename:
  - React context (`useContext`, `createContext`)
  - Execution context / request context
  - `TaskContext` type name (Phase 1 removes this anyway)
  - `additionalContext` in scorer.ts (this is the scorer parameter name, not the item field)
- The libsql SQL strings that reference `context` as a column name must be renamed.

---

## Task 0c — Rename dataset-level `outputSchema` → `groundTruthSchema`

This schema validates the `expectedOutput` (now `groundTruth`) field on dataset items. The field name should match.

### Files

| File                                                     | Lines                       | What to change                                                             |
| -------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `packages/core/src/storage/constants.ts`                 | 204                         | `DATASETS_SCHEMA.outputSchema` → `DATASETS_SCHEMA.groundTruthSchema`       |
| `packages/core/src/storage/types.ts`                     | 960                         | `CreateDatasetInput.outputSchema` → `CreateDatasetInput.groundTruthSchema` |
| `packages/core/src/storage/domains/datasets/base.ts`     | (search for `outputSchema`) | Validation references                                                      |
| `packages/core/src/storage/domains/datasets/inmemory.ts` | (search for `outputSchema`) | Storage references                                                         |
| `stores/libsql/src/storage/domains/datasets/index.ts`    | (search for `outputSchema`) | SQL references                                                             |
| `packages/server/src/server/schemas/datasets.ts`         | 65, 73                      | Zod schema field + description                                             |
| `packages/server/src/server/handlers/datasets.ts`        | (search for `outputSchema`) | Handler references                                                         |
| `client-sdks/client-js/src/types.ts`                     | (search for `outputSchema`) | Client type                                                                |
| `packages/playground-ui/src/domains/datasets/`           | (search for `outputSchema`) | UI references                                                              |

### Caution

- **Do NOT rename `outputSchema` in non-dataset contexts** (evals, tools, workflows all use `outputSchema` for different purposes).
- Only rename within dataset-related files or where it's clearly part of the `DATASETS_SCHEMA` / `Dataset` type.

---

## Completion Criteria

### Task 0a

- [ ] `grep -r 'expectedOutput' packages/core/src/storage/` → **zero matches**
- [ ] `grep -r 'expectedOutput' packages/core/src/datasets/` → **zero matches**
- [ ] `grep -r 'expectedOutput' stores/libsql/src/storage/domains/datasets/` → **zero matches**
- [ ] `grep -r 'expectedOutput' stores/libsql/src/storage/domains/runs/` → **zero matches**
- [ ] `grep -r 'expectedOutput' packages/server/src/server/` → **zero matches**
- [ ] `grep -r 'expectedOutput' client-sdks/client-js/src/` → **zero matches**
- [ ] `grep -r 'expectedOutput' packages/playground-ui/src/domains/datasets/` → **zero matches**
- [ ] `grep -r 'expectedOutput' packages/playground/src/pages/datasets/` → **zero matches**
- [ ] `grep -r 'groundTruth' packages/core/src/storage/types.ts` → **8 matches** (one per interface)
- [ ] `grep -r 'groundTruth' packages/core/src/storage/constants.ts` → **2 matches** (DATASET_ITEMS_SCHEMA + RUN_RESULTS_SCHEMA)

### Task 0b

- [ ] `grep -r '\.context' packages/core/src/storage/types.ts` — zero dataset-item-level `context` fields (now `metadata`)
- [ ] `grep -r '\.context' packages/core/src/storage/domains/datasets/` → **zero matches**
- [ ] `grep 'context' packages/core/src/storage/constants.ts` — only in non-dataset schemas (check manually)
- [ ] `grep -r '\.context' stores/libsql/src/storage/domains/datasets/` → **zero matches**
- [ ] `grep -r '\.context' packages/playground-ui/src/domains/datasets/` → **zero dataset-item refs**

### Task 0c

- [ ] `grep 'outputSchema' packages/core/src/storage/constants.ts` → **zero matches**
- [ ] `grep 'groundTruthSchema' packages/core/src/storage/constants.ts` → **1 match** (DATASETS_SCHEMA)

### Build verification

- [ ] `pnpm build:core` passes
- [ ] `pnpm build` passes
- [ ] `pnpm test:core` passes
- [ ] `pnpm typecheck` passes (no new errors)
- [ ] Existing tests in `stores/libsql` pass

---

## Risks

| Risk                                                       | Mitigation                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DB column rename breaks existing data**                  | This is a pre-shipped feature on a local branch — no production data exists. New column names take effect on next table creation.                  |
| **`context` rename collides with React/execution context** | Only rename `.context` on dataset item objects. Use targeted find-and-replace, not global.                                                         |
| **`outputSchema` rename hits non-dataset uses**            | Only rename in dataset-related files. Evals/tools/workflows `outputSchema` is a different concept.                                                 |
| **Playground UI displays wrong labels after rename**       | UI already displays "Metadata" for `context`. Field name change is invisible to users. `expectedOutput` UI labels should change to "Ground Truth". |
