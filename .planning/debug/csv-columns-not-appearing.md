---
status: diagnosed
trigger: 'Diagnose why CSV columns are not appearing in the column mapping step.'
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:00:05Z
---

## Current Focus

hypothesis: CONFIRMED - useState initializer only runs once, mapping never updates when headers change
test: verified no useEffect in use-column-mapping.ts
expecting: mapping remains {} even after headers populated
next_action: return diagnosis

## Symptoms

expected: After uploading CSV and clicking Next to mapping step, all CSV column headers appear as draggable chips in Ignore zone
actual: User sees 4 drop zones but no CSV columns appear anywhere
errors: none reported
reproduction: Upload CSV -> Preview (click Next) -> Mapping step shows empty zones
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-01-26T00:00:01Z
  checked: csv-import-dialog.tsx line 68
  found: columnMapping hook initialized with `parsedCSV?.headers ?? []`
  implication: Hook initializes with empty array before CSV is parsed

- timestamp: 2026-01-26T00:00:02Z
  checked: use-column-mapping.ts line 25-29
  found: useState initializer creates mapping object from headers array
  implication: If headers=[], mapping={}

- timestamp: 2026-01-26T00:00:03Z
  checked: column-mapping-step.tsx line 37-39
  found: getColumnsForZone filters headers.filter(h => mapping[h] === zone)
  implication: If mapping={}, all zones will be empty

- timestamp: 2026-01-26T00:00:04Z
  checked: csv-import-dialog.tsx line 76-77
  found: After file parse, columnMapping.resetMapping() is called
  implication: resetMapping uses headers from closure (empty array at init time)

- timestamp: 2026-01-26T00:00:05Z
  checked: use-column-mapping.ts line 41-48
  found: resetMapping callback has headers in dependency array but uses stale headers from closure
  implication: useState initializer runs once with empty headers, never re-initializes when headers change

## Resolution

root_cause: useColumnMapping hook's useState initializer runs only once with empty headers array (line 25-29). When headers prop updates after CSV parse, the mapping state never rebuilds. No useEffect exists to sync mapping with headers changes.
fix: Add useEffect in use-column-mapping.ts to rebuild mapping when headers array changes
verification: n/a (diagnose-only mode)
files_changed: [use-column-mapping.ts]
