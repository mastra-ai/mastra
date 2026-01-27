---
status: diagnosed
phase: 07-csv-import
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-01-27T05:30:00Z
updated: 2026-01-27T05:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Import CSV Button Visible
expected: In dataset detail page, "Import CSV" button appears next to "Add Item" button in items list header. In empty dataset, button also appears below Add Item.
result: pass

### 2. Open CSV Import Dialog
expected: Clicking "Import CSV" button opens a dialog with file upload interface.
result: pass

### 3. Upload CSV via Click
expected: Clicking the upload area opens file picker. Selecting a CSV file parses it and shows preview.
result: pass

### 4. Upload CSV via Drag-Drop
expected: Dragging a CSV file onto the upload area parses it and shows preview.
result: pass

### 5. Preview Shows Parsed Data
expected: After upload, preview step shows first 5 rows of CSV data in a table with column headers. Shows "(showing N of M rows)" below table.
result: pass

### 6. Column Mapping Zones
expected: Mapping step shows four drop zones: Input (required), Expected Output, Metadata, and Ignore. All CSV columns start in Ignore zone.
result: issue
reported: "I see 4 drop zones but I do not see any CSV columns start anywhere"
severity: major

### 7. Drag Columns Between Zones
expected: Dragging a column chip from one zone to another moves it. Dropping on Input zone marks that column for import.
result: skipped
reason: blocked on test 6 (columns not visible)

### 8. Validation Blocks Without Input
expected: Clicking "Validate & Import" without any column mapped to Input shows error: must map at least one column to Input.
result: skipped
reason: blocked on test 6 (columns not visible)

### 9. Validation Reports Empty Rows
expected: If CSV has rows with empty/null values in mapped Input column, validation shows row numbers with errors (e.g., "Row 3: missing input value").
result: skipped
reason: blocked on test 6 (columns not visible)

### 10. Import Progress Display
expected: During import, dialog shows progress: "Importing X of Y items..." with count incrementing as items are added.
result: pass

### 11. Successful Import Closes Dialog
expected: After all items imported, dialog shows success message with count. Clicking "Done" closes dialog and items appear in list.
result: skipped
reason: blocked on test 6 (can't select columns)

### 12. JSON Cell Auto-Parsing
expected: CSV cells containing JSON (starting with { or [) are automatically parsed as objects/arrays, not kept as strings.
result: skipped
reason: blocked on test 6 (can't select columns)

## Summary

total: 12
passed: 6
issues: 1
pending: 0
skipped: 5

## Gaps

- truth: "All CSV columns start in Ignore zone and are visible as draggable chips"
  status: failed
  reason: "User reported: I see 4 drop zones but I do not see any CSV columns start anywhere"
  severity: major
  test: 6
  root_cause: "useColumnMapping hook's useState initializer runs once with empty headers array, never updates when headers prop changes after CSV parse"
  artifacts:
    - path: "packages/playground-ui/src/domains/datasets/hooks/use-column-mapping.ts"
      issue: "Missing useEffect to sync mapping with headers prop changes"
  missing:
    - "Add useEffect that rebuilds mapping object when headers array reference changes"
  debug_session: ".planning/debug/csv-columns-not-appearing.md"
