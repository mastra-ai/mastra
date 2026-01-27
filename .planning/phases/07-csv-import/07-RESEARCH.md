# Phase 7: CSV Import - Research

**Researched:** 2026-01-26
**Domain:** CSV parsing, file upload, drag-drop column mapping, React UI
**Confidence:** HIGH

## Summary

This phase implements CSV import for datasets in the playground UI. The codebase already has the foundation in place:

- `@hello-pangea/dnd` for drag-drop (already in playground-ui)
- Existing `addItem` mutation in `use-dataset-mutations.ts`
- Dialog patterns and Table components in design system
- TanStack Query for cache invalidation

The standard approach is PapaParse for CSV parsing (browser-native, worker support) combined with the existing drag-drop library for column mapping. The UI flow follows Braintrust/Langfuse patterns: Upload → Preview → Map columns → Validate → Import.

**Primary recommendation:** Use PapaParse for parsing + existing @hello-pangea/dnd for column mapping UI. Loop through parsed rows and call existing `addItem` mutation per row.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | ^5.5.x | CSV parsing | Industry standard, 700k+ weekly downloads, RFC 4180 compliant, web worker support |
| @types/papaparse | ^5.5.x | TypeScript types | Official DefinitelyTyped package |

### Already Available in Codebase

| Library | Location | Purpose |
|---------|----------|---------|
| @hello-pangea/dnd | playground-ui deps | Drag-drop for column mapping (already used in agent-metadata-model-list.tsx) |
| @tanstack/react-query | playground-ui deps | Mutations with cache invalidation |
| @radix-ui/react-dialog | playground-ui/ds | Modal dialog pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse | csv-parse | csv-parse better for Node.js streaming; papaparse better for browser |
| @hello-pangea/dnd | dnd-kit | dnd-kit more flexible but @hello-pangea/dnd already in codebase |

**Installation:**
```bash
pnpm add papaparse @types/papaparse --filter @mastra/playground-ui
```

## Architecture Patterns

### Recommended Project Structure
```
packages/playground-ui/src/domains/datasets/
├── components/
│   ├── csv-import/
│   │   ├── csv-import-dialog.tsx       # Main dialog orchestrating flow
│   │   ├── csv-upload-step.tsx         # File upload dropzone
│   │   ├── csv-preview-table.tsx       # Shows first 5 rows
│   │   ├── column-mapping-step.tsx     # Drag-drop mapping UI
│   │   └── validation-summary.tsx      # Error display before commit
│   └── ...existing components
├── hooks/
│   ├── use-csv-parser.ts               # PapaParse wrapper hook
│   ├── use-column-mapping.ts           # State for column mappings
│   └── ...existing hooks
└── utils/
    ├── csv-validation.ts               # Validation rules
    └── json-cell-parser.ts             # Auto-parse JSON strings
```

### Pattern 1: Multi-Step Dialog State Machine

**What:** Single dialog component managing import steps via state
**When to use:** Complex multi-step flows within a modal
**Example:**
```typescript
// Source: Existing pattern in add-item-dialog.tsx
type ImportStep = 'upload' | 'preview' | 'mapping' | 'validating' | 'complete';

const [step, setStep] = useState<ImportStep>('upload');
const [parsedData, setParsedData] = useState<ParseResult | null>(null);
const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
```

### Pattern 2: DragDropContext with Droppable Zones

**What:** Multiple drop zones representing target fields (input, expectedOutput, metadata)
**When to use:** Braintrust-style column categorization
**Example:**
```typescript
// Source: Existing pattern in agent-metadata-model-list.tsx
<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="input-zone">...</Droppable>
  <Droppable droppableId="expected-zone">...</Droppable>
  <Droppable droppableId="metadata-zone">...</Droppable>
  <Droppable droppableId="ignore-zone">...</Droppable>
</DragDropContext>
```

### Pattern 3: Sequential Mutations with Progress

**What:** Import items one-by-one, tracking success/failure count
**When to use:** Bulk operations that need individual error handling
**Example:**
```typescript
// Leverage existing addItem mutation from use-dataset-mutations.ts
for (const row of validRows) {
  try {
    await addItem.mutateAsync({ datasetId, input: row.input, expectedOutput: row.expectedOutput });
    successCount++;
  } catch (e) {
    errors.push({ row: row.lineNumber, message: e.message });
  }
}
```

### Anti-Patterns to Avoid

- **Batch endpoint assumption:** Don't assume a bulk import API exists. Use existing `addItem` per row.
- **Blocking main thread:** Don't parse large CSVs synchronously. Use PapaParse's `worker: true`.
- **Silent failures:** Don't swallow JSON parse errors. Warn on malformed JSON cells.
- **Skip validation:** Don't allow import before validation step completes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom regex/split parser | PapaParse | Handles quotes, newlines in cells, RFC 4180 edge cases |
| Drag-drop | Custom mouse event handlers | @hello-pangea/dnd | Already in codebase, handles accessibility, touch events |
| File upload UI | Native `<input type="file">` only | Styled dropzone component | Better UX, drag-drop support |
| Type conversions | Manual string→number parsing | PapaParse `dynamicTyping: false` + custom JSON parse | Predictable handling of JSON strings in cells |

**Key insight:** CSV looks simple but has edge cases (quoted fields, embedded newlines, various delimiters). PapaParse handles RFC 4180 correctly. Hand-rolling leads to bugs with malformed files.

## Common Pitfalls

### Pitfall 1: JSON Auto-Parse Breaking on Malformed JSON
**What goes wrong:** User has a cell like `{broken json` and entire import fails
**Why it happens:** Strict JSON.parse throws on invalid JSON
**How to avoid:** Try-parse JSON, on failure keep as string with warning
**Warning signs:** Tests fail with SyntaxError: Unexpected token

### Pitfall 2: Empty Cells Becoming Empty Strings
**What goes wrong:** Empty CSV cell becomes "" instead of null, breaks downstream logic
**Why it happens:** PapaParse default behavior
**How to avoid:** Post-process: `value === '' ? null : value`
**Warning signs:** Validation complains about empty string inputs

### Pitfall 3: Header Row Not Detected
**What goes wrong:** First row of data gets treated as column names
**Why it happens:** CSV without header row uploaded
**How to avoid:** Require header row (per CONTEXT.md decision); show preview to user
**Warning signs:** Column names look like data values

### Pitfall 4: Large File Freezes Browser
**What goes wrong:** 10k+ row CSV makes page unresponsive
**Why it happens:** Synchronous parsing blocks main thread
**How to avoid:** Use PapaParse `worker: true` for large files
**Warning signs:** Page becomes unresponsive during upload

### Pitfall 5: Column Mapping State Lost on Re-render
**What goes wrong:** User maps columns, re-render resets state
**Why it happens:** Mapping state not properly memoized or lifted
**How to avoid:** Lift state to dialog component, use stable keys for Draggable items
**Warning signs:** Mapping resets when switching between preview and mapping tabs

## Code Examples

### PapaParse with File Input
```typescript
// Source: https://www.papaparse.com/docs
import Papa from 'papaparse';

interface ParsedCSV {
  headers: string[];
  data: Record<string, unknown>[];
  errors: Papa.ParseError[];
}

function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false, // Keep as strings, we'll parse JSON manually
      worker: file.size > 1_000_000, // Use worker for files > 1MB
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          data: results.data as Record<string, unknown>[],
          errors: results.errors,
        });
      },
      error: (error) => reject(error),
    });
  });
}
```

### JSON Cell Auto-Parse with Warning
```typescript
// Source: Langfuse pattern - auto-parse JSON strings, warn on failure
function parseJSONCell(value: string | null | undefined): {
  parsed: unknown;
  warning?: string;
} {
  if (value === null || value === undefined || value === '') {
    return { parsed: null };
  }

  const trimmed = value.trim();

  // Check if looks like JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return { parsed: JSON.parse(trimmed) };
    } catch {
      return {
        parsed: value,
        warning: `Could not parse as JSON, keeping as string`
      };
    }
  }

  return { parsed: value };
}
```

### Column Mapping with @hello-pangea/dnd
```typescript
// Source: Existing pattern in packages/playground-ui/.../agent-metadata-model-list.tsx
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type FieldType = 'input' | 'expectedOutput' | 'metadata' | 'ignore';

interface ColumnMapping {
  [columnName: string]: FieldType;
}

function handleDragEnd(result: DropResult, mapping: ColumnMapping, setMapping: (m: ColumnMapping) => void) {
  if (!result.destination) return;

  const column = result.draggableId;
  const newField = result.destination.droppableId as FieldType;

  setMapping({ ...mapping, [column]: newField });
}
```

### Validation Before Import
```typescript
// Source: Custom - implements CONTEXT.md validation rules
interface ValidationResult {
  valid: boolean;
  errors: Array<{ row: number; column: string; message: string }>;
}

function validateMappedData(
  data: Record<string, unknown>[],
  mapping: ColumnMapping
): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const inputColumn = Object.entries(mapping).find(([_, type]) => type === 'input')?.[0];

  if (!inputColumn) {
    return { valid: false, errors: [{ row: 0, column: '', message: 'No column mapped to input' }] };
  }

  data.forEach((row, idx) => {
    const inputValue = row[inputColumn];
    if (inputValue === null || inputValue === undefined || inputValue === '') {
      errors.push({ row: idx + 2, column: inputColumn, message: 'Input is required' }); // +2 for header + 1-indexed
    }
  });

  return { valid: errors.length === 0, errors };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV string split | PapaParse with RFC 4180 | 2014+ | Handles edge cases correctly |
| react-beautiful-dnd | @hello-pangea/dnd | 2023 | Atlassian deprecated original, community fork maintained |
| Sync file read | Web Worker parsing | 2020+ | Non-blocking for large files |

**Deprecated/outdated:**
- react-beautiful-dnd: Unmaintained since 2022, use @hello-pangea/dnd fork (already in codebase)
- Manual FileReader handling: PapaParse handles this internally

## Open Questions

1. **Batch Import API**
   - What we know: Current API is single-item `addItem`
   - What's unclear: Should we add a bulk endpoint for performance?
   - Recommendation: Start with sequential `addItem` calls; add bulk endpoint if performance is issue

2. **Progress Indicator for Large Imports**
   - What we know: 1000+ items will take time
   - What's unclear: Best UX for long-running imports
   - Recommendation: Show progress bar with row count, allow cancel

## Sources

### Primary (HIGH confidence)
- PapaParse official docs: https://www.papaparse.com/docs - API options, config
- @hello-pangea/dnd: Already in codebase at packages/playground-ui/package.json

### Secondary (MEDIUM confidence)
- Braintrust dataset docs: https://www.braintrust.dev/docs/annotate/datasets - Column mapping UX pattern
- Langfuse changelog: https://langfuse.com/changelog/2025-01-27-Dataset-Items-csv-upload - JSON auto-parse pattern

### Tertiary (LOW confidence)
- WebSearch results on CSV pitfalls - Community consensus on common issues

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PapaParse is industry standard, @hello-pangea/dnd already in codebase
- Architecture: HIGH - Following existing codebase patterns (dialogs, mutations, drag-drop)
- Pitfalls: MEDIUM - Based on documentation + community experience, not first-hand

**Research date:** 2026-01-26
**Valid until:** 60 days (stable domain, libraries well-established)
