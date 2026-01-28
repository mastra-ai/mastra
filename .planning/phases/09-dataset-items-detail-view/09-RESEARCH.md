# Phase 9: Dataset Items Detail View - Research

**Researched:** 2026-01-28
**Domain:** React UI Components, Design System Patterns
**Confidence:** HIGH

## Summary

This phase transforms the existing table-based dataset items list into an EntryList-based implementation with SideDialog for item details, following established patterns from the Traces/Observability page. The research reveals all required components already exist in the design system (`playground-ui`), and the implementation can directly follow documented patterns.

The existing `ItemsList` component uses a Table pattern with inline action buttons and must be converted to use `EntryList` compound component (the same component used by `TracesList`). Item details will be displayed in a `SideDialog` with prev/next navigation, and edit/delete flows will be embedded within the dialog rather than as separate modals.

**Primary recommendation:** Refactor `ItemsList` to use `EntryList` compound component pattern, create a new `ItemDetailDialog` component using `SideDialog` with embedded edit mode (not a separate dialog), and manage state via the existing `useDatasetMutations` hook.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library                 | Version  | Purpose                  | Why Standard                                                                     |
| ----------------------- | -------- | ------------------------ | -------------------------------------------------------------------------------- |
| `@mastra/playground-ui` | internal | Design system components | Mandated by project architecture - all UI primitives must come from this package |
| `@tanstack/react-query` | v5.x     | Server state management  | Already used throughout; provides mutation/query cache invalidation              |
| `date-fns`              | v4.x     | Date formatting          | Consistent with existing codebase (see traces-list.tsx line 4)                   |
| `lucide-react`          | latest   | Icons                    | Standard icon library used throughout playground-ui                              |

### Supporting

| Library                        | Version | Purpose              | When to Use                                        |
| ------------------------------ | ------- | -------------------- | -------------------------------------------------- |
| `sonner`                       | v1.x    | Toast notifications  | Success/error feedback (wrapped via `@/lib/toast`) |
| `@radix-ui/react-dialog`       | v1.x    | Dialog primitives    | Already powers SideDialog component                |
| `@radix-ui/react-alert-dialog` | v1.x    | Confirmation dialogs | Delete confirmation flow                           |

### Alternatives Considered

| Instead of         | Could Use               | Tradeoff                                                                    |
| ------------------ | ----------------------- | --------------------------------------------------------------------------- |
| Embedded edit mode | Separate EditItemDialog | Separate dialog exists but requirements specify edit mode within SideDialog |

**Installation:**
No new packages needed - all dependencies already exist in playground-ui.

## Architecture Patterns

### Recommended Component Structure

```
packages/playground-ui/src/domains/datasets/components/
├── dataset-detail/
│   ├── items-list.tsx           # REFACTOR: Table -> EntryList pattern
│   ├── item-detail-dialog.tsx   # NEW: SideDialog with edit/delete
│   └── ... existing files ...
```

### Pattern 1: EntryList Compound Component

**What:** Composable list component for displaying entries with consistent styling and interactions
**When to use:** Any list requiring item selection, click-to-detail navigation
**Example:**

```typescript
// Source: packages/playground-ui/src/domains/observability/components/traces-list.tsx
const itemsListColumns = [
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'expectedOutput', label: 'Expected Output', size: '200px' },
  { name: 'metadata', label: 'Metadata', size: '150px' },
  { name: 'createdAt', label: 'Created', size: '100px' },
];

export function ItemsList({ items, selectedItemId, onItemClick }: ItemsListProps) {
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={itemsListColumns} />
        <EntryList.Entries>
          {items.map(item => (
            <EntryList.Entry
              key={item.id}
              entry={item}
              isSelected={selectedItemId === item.id}
              columns={itemsListColumns}
              onClick={onItemClick}
            >
              {itemsListColumns.map(col => (
                <EntryList.EntryText key={col.name}>
                  {formatColumn(item, col.name)}
                </EntryList.EntryText>
              ))}
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}
```

### Pattern 2: SideDialog with Navigation

**What:** Slide-in panel with prev/next navigation for browsing list items
**When to use:** Detail views that need to allow sequential browsing
**Example:**

```typescript
// Source: packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx
<SideDialog
  dialogTitle="Item Details"
  dialogDescription={`Item: ${item.id}`}
  isOpen={isOpen}
  onClose={onClose}
  level={1}
>
  <SideDialog.Top>
    <TextAndIcon>
      <HashIcon /> {getShortId(item.id)}
    </TextAndIcon>
    |
    <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
  </SideDialog.Top>
  <SideDialog.Content>
    {/* Content here */}
  </SideDialog.Content>
</SideDialog>
```

### Pattern 3: Inline Edit Mode Toggle

**What:** Single component that switches between read-only view and editable form
**When to use:** When edit experience should stay in same dialog rather than spawning new modal
**Example:**

```typescript
// Pattern derived from requirements and existing edit-item-dialog.tsx
function ItemDetailDialog({ item, ... }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ input: '', expectedOutput: '', metadata: '' });

  // Sync form state when item changes or entering edit mode
  useEffect(() => {
    setFormData({
      input: JSON.stringify(item.input, null, 2),
      expectedOutput: item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '',
      metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
    });
  }, [item.id, item.input, item.expectedOutput, item.metadata]);

  return (
    <SideDialog isOpen={isOpen} onClose={onClose} ...>
      <SideDialog.Top>
        {/* Navigation */}
        {!isEditing && (
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
            <Button onClick={handleDelete}>Delete</Button>
          </div>
        )}
      </SideDialog.Top>
      <SideDialog.Content>
        {isEditing ? (
          <EditForm formData={formData} onSave={handleSave} onCancel={() => setIsEditing(false)} />
        ) : (
          <ReadOnlyView item={item} />
        )}
      </SideDialog.Content>
    </SideDialog>
  );
}
```

### Pattern 4: AlertDialog for Delete Confirmation

**What:** Modal confirmation before destructive actions
**When to use:** Delete operations requiring user confirmation
**Example:**

```typescript
// Source: packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx
<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Item</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete this item? This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onClick={handleDeleteConfirm}>Yes, Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog>
```

### Anti-Patterns to Avoid

- **Action buttons in list rows:** Requirements explicitly state "no action buttons on dataset item rows" - clicking opens detail dialog instead
- **Separate edit dialog:** Edit mode must be inline within SideDialog, not a separate `EditItemDialog` modal
- **Table component for EntryList use cases:** Use `EntryList` compound component, not `Table`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem                   | Don't Build           | Use Instead                                            | Why                                                         |
| ------------------------- | --------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| List with click-to-select | Custom list rendering | `EntryList` compound component                         | Handles selection state, hover effects, keyboard nav        |
| Slide-in detail panel     | Custom dialog         | `SideDialog` component                                 | Consistent animations, accessibility, nested dialog support |
| Prev/next navigation      | Manual index tracking | `SideDialog.Nav` with computed handlers                | Standard pattern from Traces page                           |
| Toast notifications       | Manual state          | `toast.success()` / `toast.error()` from `@/lib/toast` | Consistent styling, auto-dismiss                            |
| Date formatting           | Manual formatting     | `date-fns` format/isToday                              | Consistent with traces-list.tsx                             |
| JSON editing              | Basic textarea        | `CodeEditor` component                                 | Syntax highlighting, validation feedback                    |

**Key insight:** All UI primitives exist in playground-ui design system. The task is composition and state management, not creating new primitives.

## Common Pitfalls

### Pitfall 1: Not Syncing Form State on Item Change

**What goes wrong:** Edit form shows stale data when navigating to different item while in edit mode
**Why it happens:** Form state isn't reset when `item.id` prop changes
**How to avoid:** Use `useEffect` with `item.id` dependency to reset form state (see existing `EditItemDialog` pattern)
**Warning signs:** Editing item A, navigating to item B while still in edit mode, seeing item A's data

### Pitfall 2: Edit Mode Persists Across Navigation

**What goes wrong:** User clicks next/prev while editing, edit mode stays active on new item
**Why it happens:** isEditing state not reset when item changes
**How to avoid:** Either exit edit mode on navigation, or include `item.id` in effect dependencies to reset form
**Warning signs:** User navigates to next item and sees edit form with wrong data

### Pitfall 3: Dialog State Management Conflicts

**What goes wrong:** Delete confirmation dialog and SideDialog have conflicting open states
**Why it happens:** AlertDialog inside SideDialog with incorrect portal management
**How to avoid:** Use AlertDialog within SideDialog.Content, let Radix handle portal stacking
**Warning signs:** Clicking Cancel on delete confirmation closes both dialogs

### Pitfall 4: Navigation Handler Returns undefined vs null

**What goes wrong:** Navigation buttons don't disable properly at list boundaries
**Why it happens:** SideDialog.Nav expects `undefined` or `null` to disable, not a function returning undefined
**How to avoid:** Return `undefined` from navigation handler computation when at boundary (see `toNextSpan` pattern in trace-dialog.tsx)
**Warning signs:** Next button enabled when viewing last item

### Pitfall 5: Missing Toast on Success/Error

**What goes wrong:** User doesn't know if action succeeded
**Why it happens:** Forgetting to add toast notification after mutation
**How to avoid:** Always call `toast.success()` or `toast.error()` in mutation success/error handlers
**Warning signs:** User saves/deletes and nothing visual happens

## Code Examples

Verified patterns from official sources:

### Prev/Next Navigation Handler Pattern

```typescript
// Source: packages/playground-ui/src/domains/observability/components/trace-dialog.tsx (lines 206-225)
const toNextItem = () => {
  if (!selectedItemId) return undefined;
  const currentIndex = items.findIndex(item => item.id === selectedItemId);
  if (currentIndex >= 0 && currentIndex < items.length - 1) {
    return () => setSelectedItemId(items[currentIndex + 1].id);
  }
  return undefined; // Disables button
};

const toPreviousItem = () => {
  if (!selectedItemId) return undefined;
  const currentIndex = items.findIndex(item => item.id === selectedItemId);
  if (currentIndex > 0) {
    return () => setSelectedItemId(items[currentIndex - 1].id);
  }
  return undefined; // Disables button
};
```

### Form State Sync Pattern

```typescript
// Source: packages/playground-ui/src/domains/datasets/components/edit-item-dialog.tsx (lines 30-34)
useEffect(() => {
  setInput(JSON.stringify(item.input, null, 2));
  setExpectedOutput(item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '');
}, [item.id, item.input, item.expectedOutput]);
```

### Date Formatting Pattern

```typescript
// Source: packages/playground-ui/src/domains/observability/components/traces-list.tsx (lines 56-58)
import { format, isToday } from 'date-fns';

const createdAtDate = new Date(item.createdAt);
const isTodayDate = isToday(createdAtDate);
const dateDisplay = isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd');
```

### Mutation with Toast Pattern

```typescript
// Source: packages/playground-ui/src/domains/datasets/components/edit-item-dialog.tsx (lines 59-72)
try {
  await updateItem.mutateAsync({
    datasetId,
    itemId: item.id,
    input: parsedInput,
    expectedOutput: parsedExpectedOutput,
  });
  toast.success('Item updated successfully');
  setIsEditing(false);
} catch (error) {
  toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

### SideDialog with CodeSection Pattern

```typescript
// Source: packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx (lines 132-138)
<SideDialog.CodeSection
  title="Input"
  icon={<FileInputIcon />}
  codeStr={JSON.stringify(item.input, null, 2)}
/>
```

## State of the Art

| Old Approach          | Current Approach               | When Changed            | Impact                                        |
| --------------------- | ------------------------------ | ----------------------- | --------------------------------------------- |
| Table-based lists     | EntryList compound component   | Design system evolution | Consistent click-to-detail pattern across app |
| Separate edit dialogs | Inline edit mode in SideDialog | Phase 9 requirement     | Better UX, fewer modal layers                 |

**Deprecated/outdated:**

- Using `Table` component for lists with click-to-detail - use `EntryList` instead
- `EditItemDialog` as standalone modal - edit mode should be inline in `ItemDetailDialog`

## Open Questions

None - all requirements are clear and all components are documented with working examples.

## Sources

### Primary (HIGH confidence)

- `packages/playground-ui/src/domains/observability/components/traces-list.tsx` - EntryList pattern reference
- `packages/playground-ui/src/domains/observability/components/trace-dialog.tsx` - SideDialog with navigation pattern
- `packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx` - SideDialog for detail view
- `packages/playground-ui/src/domains/datasets/components/edit-item-dialog.tsx` - Edit form state management
- `packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx` - Current implementation to refactor
- `packages/playground-ui/src/ds/components/EntryList/*.tsx` - EntryList component internals
- `packages/playground-ui/src/ds/components/SideDialog/*.tsx` - SideDialog component internals

### Secondary (MEDIUM confidence)

- None needed - all patterns verified in codebase

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All components exist and are documented with examples
- Architecture: HIGH - Follows exact patterns from Traces/Observability page
- Pitfalls: HIGH - Based on existing code patterns and requirements

**Research date:** 2026-01-28
**Valid until:** 30+ days (stable internal design system)
