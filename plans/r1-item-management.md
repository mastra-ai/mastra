# R1: Item Management Implementation

Track edit/delete functionality for dataset items.

---

## Status: Complete

**Started:** 2025-01-15
**Completed:** 2025-01-15

---

## Pre-requisites

| Layer                        | Status |
| ---------------------------- | ------ |
| Storage `updateDatasetItem`  | Done   |
| Storage `archiveDatasetItem` | Done   |
| Storage `getDatasetItemById` | Done   |

---

## Tasks

### Batch 1: Server (parallel)

| ID  | Task                                     | Status |
| --- | ---------------------------------------- | ------ |
| 1a  | Add `datasetItemIdPathParams` schema     | done   |
| 1b  | Add `updateDatasetItemBodySchema`        | done   |
| 1c  | Add `UPDATE_DATASET_ITEM_ROUTE` handler  | done   |
| 1d  | Add `ARCHIVE_DATASET_ITEM_ROUTE` handler | done   |
| 1e  | Register routes in index                 | done   |

**Files:**

- `packages/server/src/server/schemas/datasets.ts`
- `packages/server/src/server/handlers/datasets.ts`
- `packages/server/src/server/server-adapter/routes/datasets.ts`

---

### Batch 2: Client SDK (parallel)

| ID  | Task                            | Status |
| --- | ------------------------------- | ------ |
| 2a  | Add `updateDatasetItem` method  | done   |
| 2b  | Add `archiveDatasetItem` method | done   |

**Files:**

- `client-sdks/client-js/src/client.ts`
- `client-sdks/client-js/src/types.ts`

---

### Batch 3: UI Hooks (parallel)

| ID  | Task                                 | Status |
| --- | ------------------------------------ | ------ |
| 3a  | Add `useUpdateDatasetItem` mutation  | done   |
| 3b  | Add `useArchiveDatasetItem` mutation | done   |

**Files:**

- `packages/playground-ui/src/domains/datasets/hooks/use-dataset-items.ts`

---

### Batch 4: UI Components (parallel)

| ID  | Task                               | Status |
| --- | ---------------------------------- | ------ |
| 4a  | Create `EditDatasetItemDialog`     | done   |
| 4b  | Add delete confirmation to actions | done   |

**Files:**

- `packages/playground-ui/src/domains/datasets/components/edit-dataset-item-dialog.tsx` (new)
- `packages/playground-ui/src/domains/datasets/components/dataset-information/dataset-information.tsx`

---

### Batch 5: Integration

| ID  | Task                                        | Status |
| --- | ------------------------------------------- | ------ |
| 5a  | Add actions column with edit/delete buttons | done   |

**Files:**

- `packages/playground-ui/src/domains/datasets/components/dataset-items-table/columns.tsx`
- `packages/playground-ui/src/domains/datasets/components/dataset-items-table/dataset-items-table.tsx`
- `packages/playground-ui/src/domains/datasets/components/index.ts`

---

## Progress

- [x] Batch 1: Server (5/5)
- [x] Batch 2: Client SDK (2/2)
- [x] Batch 3: UI Hooks (2/2)
- [x] Batch 4: UI Components (2/2)
- [x] Batch 5: Integration (1/1)

**Total: 12/12 tasks complete**

---

## Notes

- Used TanStack Table `meta` option to pass callbacks from table component to columns
- Delete is soft-delete (archive) to preserve run history
- Button component doesn't have "destructive" variant, used custom class instead
