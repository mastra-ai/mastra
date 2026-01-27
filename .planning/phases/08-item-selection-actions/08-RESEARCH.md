# Phase 8: Item Selection & Actions - Research

**Researched:** 2026-01-27
**Domain:** React UI State Management, Bulk Operations, CSV Export
**Confidence:** HIGH

## Summary

Phase 8 adds bulk operations to the dataset items list. The existing codebase provides all necessary infrastructure:

- **UI Components**: Radix Checkbox, Popover, AlertDialog already available in `packages/playground-ui/src/ds/components/`
- **Data Fetching**: TanStack Query hooks exist in `use-datasets.ts` and `use-dataset-mutations.ts`
- **CSV Handling**: PapaParse library already installed; `use-csv-parser.ts` provides patterns
- **Toast System**: Sonner-based toast system at `src/lib/toast.tsx`

This is primarily a **UI composition phase** with minimal backend changes. The main work is:
1. Selection state management (React useState + custom hook)
2. Three-dot menu with Popover
3. Checkbox integration into `ItemsList` table
4. CSV export utility (client-side using PapaParse)
5. Create dataset modal (reuse existing `CreateDatasetDialog`)
6. Bulk delete with confirmation

**Primary recommendation:** Build a `useItemSelection` hook that manages selected IDs, shift-click range selection, and select-all behavior. Compose UI from existing design system components.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in use |
| @radix-ui/react-checkbox | 1.3.2 | Checkbox primitives | Already installed |
| @radix-ui/react-popover | 1.1.14 | Menu dropdown | Already installed |
| @radix-ui/react-alert-dialog | 1.1.14 | Confirmation dialogs | Already installed |
| @tanstack/react-query | 5.x | Server state | Already in use for datasets |
| papaparse | 5.5.3 | CSV generation/parsing | Already installed |
| sonner | 2.0.5 | Toast notifications | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.474.0 | Icons | MoreVertical, Check, Download, Plus, Trash2 |
| @mastra/client-js | local | API client | Dataset mutations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom selection hook | react-table selection | react-table overkill for simple list |
| Radix Popover | DropdownMenu | Popover gives more control, already used |
| Client-side CSV | Server endpoint | No backend change needed, faster |

**Installation:** None required - all dependencies already present.

## Architecture Patterns

### Recommended File Structure

```
src/domains/datasets/
├── components/
│   └── dataset-detail/
│       ├── items-list.tsx         # MODIFY: Add checkbox column + selection mode
│       ├── items-list-actions.tsx # NEW: Three-dot menu + action buttons
│       └── selection-bar.tsx      # NEW: "Select all" checkbox + count display
├── hooks/
│   ├── use-item-selection.ts      # NEW: Selection state management
│   └── use-dataset-mutations.ts   # MODIFY: Add bulk delete mutation
└── utils/
    └── csv-export.ts              # NEW: Export selected items to CSV
```

### Pattern 1: Selection State Hook

**What:** Custom hook managing selection state with shift-click support
**When to use:** Any list requiring multi-select with range selection

```typescript
// src/domains/datasets/hooks/use-item-selection.ts
interface UseItemSelectionReturn<T extends { id: string }> {
  selectedIds: Set<string>;
  lastClickedId: string | null;
  isSelected: (id: string) => boolean;
  toggle: (id: string, shiftKey: boolean, allIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectedCount: number;
}

function useItemSelection<T extends { id: string }>(): UseItemSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const toggle = useCallback((id: string, shiftKey: boolean, allIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (shiftKey && lastClickedId) {
        // Range selection
        const startIdx = allIds.indexOf(lastClickedId);
        const endIdx = allIds.indexOf(id);
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

        for (let i = from; i <= to; i++) {
          next.add(allIds[i]);
        }
      } else {
        // Single toggle
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }

      return next;
    });
    setLastClickedId(id);
  }, [lastClickedId]);

  // ... rest of hook
}
```

### Pattern 2: Selection Mode State Machine

**What:** Component state tracking which action mode is active
**When to use:** UI that changes based on pending action

```typescript
type SelectionMode =
  | { type: 'idle' }
  | { type: 'selecting'; action: 'export' | 'create-dataset' | 'delete' };

function ItemsList({ ... }) {
  const [mode, setMode] = useState<SelectionMode>({ type: 'idle' });
  const selection = useItemSelection();

  const handleActionSelect = (action: SelectionMode['action']) => {
    setMode({ type: 'selecting', action });
    selection.clearSelection();
  };

  const handleCancel = () => {
    setMode({ type: 'idle' });
    selection.clearSelection();
  };

  // Action execution clears mode
  const handleActionComplete = () => {
    setMode({ type: 'idle' });
    selection.clearSelection();
    toast.success(`${selection.selectedCount} items processed`);
  };
}
```

### Pattern 3: CSV Export (Client-Side)

**What:** Convert dataset items to CSV blob and trigger download
**When to use:** Exporting structured data without server round-trip

```typescript
// src/domains/datasets/utils/csv-export.ts
import Papa from 'papaparse';

export function exportToCSV(items: DatasetItem[], filename: string): void {
  const rows = items.map(item => ({
    input: typeof item.input === 'string'
      ? item.input
      : JSON.stringify(item.input),
    expectedOutput: item.expectedOutput
      ? (typeof item.expectedOutput === 'string'
          ? item.expectedOutput
          : JSON.stringify(item.expectedOutput))
      : '',
    createdAt: item.createdAt.toISOString(),
  }));

  const csv = Papa.unparse(rows, {
    quotes: true,
    header: true,
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
```

### Anti-Patterns to Avoid

- **Storing full items in selection state:** Store only IDs, derive items when needed
- **Mutating selection state directly:** Always use immutable updates with `new Set(prev)`
- **Server-side CSV generation:** Unnecessary complexity when PapaParse is already available
- **Custom dropdown menu:** Use existing Popover + Button patterns from design system

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox component | Custom checkbox | `@radix-ui/react-checkbox` (existing) | Accessibility, styling already done |
| CSV generation | Manual string building | PapaParse `unparse()` | Handles escaping, quotes, edge cases |
| Dropdown menu | Custom dropdown | Popover + list of Buttons | Consistent with codebase patterns |
| Confirmation dialog | Custom modal | AlertDialog component | Already styled, accessible |
| Toast notifications | Custom toast | sonner via `toast.tsx` | Already configured with styling |

**Key insight:** This phase is 90% composition of existing components. The only truly new code is the selection state hook and CSV export utility.

## Common Pitfalls

### Pitfall 1: Shift-Click Range Selection Edge Cases

**What goes wrong:** Range selection breaks when items are filtered/sorted differently than displayed
**Why it happens:** Using array indices that don't match visual order
**How to avoid:** Pass `allIds` array representing current visible order to `toggle()`
**Warning signs:** Selecting wrong items when clicking with Shift held

### Pitfall 2: Stale Selection After Mutation

**What goes wrong:** Selected IDs reference deleted items
**Why it happens:** Selection state not cleared after bulk delete
**How to avoid:** Clear selection in mutation `onSuccess` callback
**Warning signs:** Attempting to operate on non-existent items

### Pitfall 3: Large Selection Performance

**What goes wrong:** UI freezes with 1000+ selected items
**Why it happens:** Re-rendering entire list on each selection change
**How to avoid:** Memoize row components, use `React.memo` with custom comparator
**Warning signs:** Noticeable lag when selecting items

### Pitfall 4: CSV Export Memory Pressure

**What goes wrong:** Browser crashes exporting 10,000+ items
**Why it happens:** Building entire CSV string in memory
**How to avoid:** For this phase, assume reasonable dataset sizes (<5000 items); future work could add streaming
**Warning signs:** Page unresponsive during export

## Code Examples

### Three-Dot Menu Component

```typescript
// Uses existing Popover from ds/components
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { MoreVertical, Download, Plus, Trash2 } from 'lucide-react';

interface ActionsMenuProps {
  onExportClick: () => void;
  onCreateDatasetClick: () => void;
  onDeleteClick: () => void;
  disabled?: boolean;
}

function ActionsMenu({
  onExportClick,
  onCreateDatasetClick,
  onDeleteClick,
  disabled
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant="ghost" size="sm" aria-label="Actions">
          <Icon><MoreVertical /></Icon>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => handleAction(onExportClick)}
        >
          <Icon><Download /></Icon>
          Export to CSV
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => handleAction(onCreateDatasetClick)}
        >
          <Icon><Plus /></Icon>
          Create Dataset
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-400"
          onClick={() => handleAction(onDeleteClick)}
        >
          <Icon><Trash2 /></Icon>
          Delete Items
        </Button>
      </PopoverContent>
    </Popover>
  );
}
```

### Bulk Delete Mutation

```typescript
// Add to use-dataset-mutations.ts
const deleteItems = useMutation({
  mutationFn: async ({ datasetId, itemIds }: { datasetId: string; itemIds: string[] }) => {
    // Sequential deletion (no bulk endpoint exists)
    for (const itemId of itemIds) {
      await client.deleteDatasetItem(datasetId, itemId);
    }
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['dataset-items', variables.datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset', variables.datasetId] });
  },
});
```

### Selection Mode UI Integration

```typescript
// Modified items-list.tsx
{mode.type === 'selecting' ? (
  <div className="flex items-center gap-2">
    <Checkbox
      checked={selection.selectedCount === items.length}
      onCheckedChange={(checked) => {
        if (checked) {
          selection.selectAll(items.map(i => i.id));
        } else {
          selection.clearSelection();
        }
      }}
    />
    <span className="text-sm text-neutral3">
      {selection.selectedCount} selected
    </span>
    <Button
      variant="primary"
      size="sm"
      disabled={selection.selectedCount === 0}
      onClick={handleExecuteAction}
    >
      {actionLabels[mode.action]}
    </Button>
    <Button variant="ghost" size="sm" onClick={handleCancel}>
      Cancel
    </Button>
  </div>
) : (
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" onClick={onAddClick}>
      <Icon><Plus /></Icon>
      Add Item
    </Button>
    {items.length > 0 && (
      <ActionsMenu
        onExportClick={() => handleActionSelect('export')}
        onCreateDatasetClick={() => handleActionSelect('create-dataset')}
        onDeleteClick={() => handleActionSelect('delete')}
      />
    )}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for selection | useState + custom hook | 2022 | Simpler, less boilerplate |
| FileSaver.js for downloads | Native Blob + URL.createObjectURL | 2020 | No extra dependency |
| Custom checkbox styling | Radix + Tailwind | 2023 | Better accessibility |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Use Clipboard API instead (not relevant here but noted)

## Open Questions

1. **Bulk delete endpoint**
   - What we know: Only single-item delete exists (`DELETE /datasets/:id/items/:itemId`)
   - What's unclear: Should we add bulk delete endpoint or iterate client-side?
   - Recommendation: Iterate client-side for now; add bulk endpoint in future phase if needed

2. **Create dataset with items**
   - What we know: `createDataset` creates empty dataset, items added separately
   - What's unclear: Should "Create Dataset from Selection" copy items atomically?
   - Recommendation: Create dataset, then add items in parallel; show progress toast

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/playground-ui/src/ds/components/` - Existing component library
- Codebase analysis: `packages/playground-ui/src/domains/datasets/` - Existing dataset patterns
- Codebase analysis: `packages/client-js/src/client.ts` - Available API methods
- Codebase analysis: `packages/server/src/server/handlers/datasets.ts` - Server endpoints

### Secondary (MEDIUM confidence)
- PapaParse documentation - CSV generation patterns (via package.json confirmation)
- Radix UI documentation - Checkbox, Popover, AlertDialog APIs

### Tertiary (LOW confidence)
- None - All findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns derived from existing codebase
- Pitfalls: MEDIUM - Some based on general React best practices

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (stable - primarily UI composition)
