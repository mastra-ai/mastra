---
phase: 07-csv-import
plan: 01
subsystem: playground-ui
tags: [csv, parsing, papaparse, validation]
dependency-graph:
  requires: [06-playground-integration]
  provides: [csv-parsing, json-cell-parsing, validation-utils]
  affects: [07-02-import-dialog]
tech-stack:
  added: [papaparse@5.5.3, @types/papaparse@5.5.2]
  patterns: [web-worker-for-large-files, json-auto-parse]
key-files:
  created:
    - packages/playground-ui/src/domains/datasets/utils/json-cell-parser.ts
    - packages/playground-ui/src/domains/datasets/utils/csv-validation.ts
    - packages/playground-ui/src/domains/datasets/hooks/use-csv-parser.ts
  modified:
    - packages/playground-ui/package.json
    - packages/playground-ui/src/domains/datasets/index.ts
decisions:
  - "JSON auto-parse: cells starting with { or [ attempt JSON.parse"
  - "Empty cells become null (not empty string)"
  - "Web worker threshold: 1MB file size"
  - "Row numbers 1-indexed + 1 for header (first data row is 2)"
metrics:
  duration: "2 min"
  completed: "2026-01-27"
---

# Phase 07 Plan 01: CSV Parsing Utilities Summary

PapaParse installed with JSON cell parsing and validation utilities for CSV import.

## What Was Built

### JSON Cell Parser (`json-cell-parser.ts`)

- `parseJSONCell()`: Handles null, JSON strings, plain strings, malformed JSON
- `parseRow()`: Applies parsing to all values, collects warnings
- Empty strings converted to null
- Malformed JSON kept as string with warning

### CSV Validation (`csv-validation.ts`)

- `validateMappedData()`: Validates mapped CSV data before import
- Checks at least one column mapped to 'input'
- Validates input columns not empty (row-level errors)
- Row numbers include header offset (first data row = 2)

### CSV Parser Hook (`use-csv-parser.ts`)

- `useCSVParser()`: React hook wrapping PapaParse
- Returns `parseFile`, `isParsing`, `error`
- Uses web worker for files >1MB
- Integrates JSON cell parsing automatically

## Commits

| Hash       | Message                                                    |
| ---------- | ---------------------------------------------------------- |
| 7e7220a1c8 | chore(07-01): install papaparse dependency                 |
| a7c823ce83 | feat(07-01): create JSON cell parser utility               |
| 30ffb46987 | feat(07-01): create CSV validation utility and parser hook |

## Deviations from Plan

None - plan executed exactly as written.

## Next Plan Readiness

Ready for 07-02 (Import Dialog UI):

- CSV parsing utilities available
- Validation ready for column mapping
- Exports added to domain index
