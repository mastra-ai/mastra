---
phase: "08"
plan: "01"
subsystem: "datasets-ui"
tags: ["selection", "csv-export", "hooks"]
dependency-graph:
  requires: []
  provides: ["useItemSelection", "exportItemsToCSV"]
  affects: ["08-02", "08-03"]
tech-stack:
  added: []
  patterns: ["range-selection", "blob-download"]
key-files:
  created:
    - packages/playground-ui/src/domains/datasets/hooks/use-item-selection.ts
    - packages/playground-ui/src/domains/datasets/utils/csv-export.ts
  modified:
    - packages/playground-ui/src/domains/datasets/index.ts
decisions: []
metrics:
  duration: "3 min"
  completed: "2026-01-27"
---

# Phase 8 Plan 01: Foundation Utilities Summary

**TL;DR:** Created useItemSelection hook for selection state management with shift-click range selection, and exportItemsToCSV utility for downloading dataset items as CSV.

## Changes Made

### Task 1: useItemSelection Hook
- `selectedIds: Set<string>` tracks selected items
- `toggle(id, shiftKey, allIds)` handles single toggle or range selection
- `selectAll(ids)` for header checkbox select-all
- `clearSelection()` resets selection state
- `lastClickedId` tracks anchor for range selection

### Task 2: CSV Export Utility
- `exportItemsToCSV(items, filename)` generates downloadable CSV
- Columns: input, expectedOutput, createdAt
- Uses Papa.unparse with quotes and headers
- JSON.stringify for object values, empty string for null
- Blob download via programmatic link click

### Task 3: Index Exports
- Both utilities exported from datasets domain index
- Available as `@mastra/playground-ui` imports

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

- Range selection uses `lastClickedId` as anchor, finds indices in `allIds` array
- CSV export follows same Papa import pattern as use-csv-parser
- Both files use existing patterns from codebase

## Commits

| Hash | Message |
|------|---------|
| e0f2643f34 | feat(08-01): create useItemSelection hook |
| 74259fc1ad | feat(08-01): create CSV export utility |

Note: Task 3 exports were included in a parallel commit (fb3438d7dc).

## Next Phase Readiness

- 08-02 (Actions Menu): Can import useItemSelection and exportItemsToCSV
- 08-03 (Checkbox Integration): useItemSelection ready for items-list.tsx integration
