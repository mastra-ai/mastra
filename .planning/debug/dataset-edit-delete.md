# Dataset Edit/Delete Buttons Missing

## ROOT CAUSE FOUND

**Root Cause:** Edit/Delete UI components exist in `DatasetDetail` but callbacks are NOT wired up in the playground page

**Evidence:**
- `DatasetDetail` component (playground-ui) accepts `onEditClick` and `onDeleteClick` props (lines 15-16)
- `DatasetDetail` renders Edit/Delete buttons when callbacks provided (lines 76-91)
- `dataset/index.tsx` (playground) does NOT pass `onEditClick` or `onDeleteClick` to `DatasetDetail`
- Mutation hooks exist: `useDatasetMutations` exports `updateDataset` and `deleteDataset`
- Client API ready: `client.updateDataset()` and `client.deleteDataset()` exist in client-js

**Files Involved:**
- `/packages/playground/src/pages/datasets/dataset/index.tsx` - Missing `onEditClick`/`onDeleteClick` props
- `/packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-detail.tsx` - Has button UI but conditionally renders based on callbacks
- `/packages/playground-ui/src/domains/datasets/index.ts` - Missing `EditDatasetDialog` and `DeleteDatasetDialog` exports
- `/packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts` - Has mutations ready

**Suggested Fix Direction:**
1. Create `EditDatasetDialog` component (copy pattern from `CreateDatasetDialog`)
2. Create `DeleteDatasetDialog` component (confirmation dialog)
3. Export both from `datasets/index.ts`
4. Wire up dialogs in `playground/src/pages/datasets/dataset/index.tsx` similar to `AddItemDialog` and `RunTriggerDialog`
