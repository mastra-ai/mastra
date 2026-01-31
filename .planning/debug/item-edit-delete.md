# Debug: Item Edit/Delete Buttons Missing

## ROOT CAUSE FOUND

**Root Cause:** UI component `ItemsList` renders table rows without edit/delete action buttons - the UI was never implemented, despite full backend and mutation hook support existing.

**Evidence:**

- `items-list.tsx` line 55-66: `Row` component renders only data cells (input, expectedOutput, createdAt) with no actions column
- `use-dataset-mutations.ts` line 49-62: `updateItem` and `deleteItem` mutations are fully implemented and exported
- `datasets.ts` (server handlers) line 307-381: `UPDATE_ITEM_ROUTE` and `DELETE_ITEM_ROUTE` are fully implemented
- `client.ts` line 927-945: `updateDatasetItem` and `deleteDatasetItem` client methods exist

**Files Involved:**

- `/packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx`: Missing actions column and edit/delete buttons
- `/packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts`: Has mutations ready but unused in UI
- `/packages/server/src/server/handlers/datasets.ts`: Backend routes exist and work
- `/client-sdks/client-js/src/client.ts`: Client SDK methods exist

**Reference Pattern:**

- `/packages/playground-ui/src/domains/agents/components/chat-threads.tsx`: Shows working delete pattern with `ThreadDeleteButton` and `AlertDialog`

**Suggested Fix Direction:**

1. Add 4th column "Actions" to ItemsList table header
2. Add `onEditClick` and `onDeleteClick` props to ItemsList
3. Render edit (Pencil icon) and delete (Trash icon) buttons in each row
4. Wire up to existing `updateItem` and `deleteItem` mutations from `useDatasetMutations`
5. Add confirmation AlertDialog for delete (follow chat-threads.tsx pattern)
6. Create EditItemDialog (similar to add-item-dialog.tsx) for edit functionality
