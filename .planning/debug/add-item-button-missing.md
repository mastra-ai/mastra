# Debug: Add Item Button Disappears After First Item

## ROOT CAUSE FOUND

**Root Cause:** The "Add Item" button is only rendered inside the `EmptyItemsList` component, which only displays when `items.length === 0`.

**Evidence:**
- `items-list.tsx` line 42-44: Returns `EmptyItemsList` only when `items.length === 0`
- `items-list.tsx` line 46-71: When items exist, renders table without any Add Item button
- `dataset-detail.tsx`: Header area has Edit/Delete/Run buttons but no Add Item button
- The `onAddItemClick` prop is passed to `ItemsList` but only used in empty state

**Files Involved:**
- `/packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx`: Add Item button only in `EmptyItemsList` (line 113-118)
- `/packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-detail.tsx`: No Add Item button in header or tab area

**Suggested Fix Direction:** Add the "Add Item" button to either:
1. The `DatasetDetail` header (next to Edit/Delete/Run buttons)
2. The `ItemsList` component when items exist (e.g., above the table or in a toolbar)
