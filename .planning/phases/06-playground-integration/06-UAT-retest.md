---
status: diagnosed
phase: 06-playground-integration
source: [06-07-SUMMARY.md, 06-08-SUMMARY.md, 06-09-SUMMARY.md, 06-10-SUMMARY.md]
started: 2026-01-26T22:35:00Z
updated: 2026-01-26T22:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dataset Edit/Delete

expected: Dataset detail page header shows Edit and Delete buttons. Edit opens dialog with current values. Delete shows confirmation.
result: pass

### 2. Item Edit/Delete

expected: Items list has Actions column with edit/delete icon buttons per row. Edit opens dialog. Delete shows confirmation.
result: pass

### 3. Add Item Button

expected: When items exist, Add Item button is visible above the items table.
result: pass

### 4. Async Run Trigger

expected: Run trigger returns immediately (< 500ms). Status shows "pending", then transitions to "running" and "completed" via polling.
result: issue
reported: "Status transitions worked but had to refresh page to see latest item results. Also SQLITE_ERROR: no such column: traceId when viewing results"
severity: major

### 5. Scores Display

expected: Run results view shows scores for each item with scorer names and values.
result: skipped
reason: Can't test due to traceId error blocking results view

### 6. Trace Links

expected: Result detail dialog shows "View Trace" link that navigates to /traces/:traceId.
result: issue
reported: "traceId not in API response - server schema missing the field"
severity: major

## Summary

total: 6
passed: 3
issues: 2
pending: 0
skipped: 1

## Diagnosed Issues

1. **Results auto-refresh** — triggerRun invalidates dataset-runs but not dataset-run-results
2. **traceId in API response** — runResultResponseSchema missing traceId field

## Gaps

- truth: "Run results update automatically after status transitions to completed"
  status: failed
  reason: "User reported: Status transitions worked but had to refresh page to see latest item results"
  severity: major
  test: 4
  root_cause: "triggerRun mutation invalidates dataset-runs but not dataset-run-results. When run completes via polling, results query not refetched."
  artifacts:
  - path: "packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts"
    issue: "Line 67: only invalidates dataset-runs, missing dataset-run-results"
    missing:
  - "Invalidate dataset-run-results query when run completes"
  - "Or: add refetchInterval to useDatasetRunResults while run.status !== completed"
    debug_session: ""

- truth: "traceId column exists in LibSQL storage"
  status: user_error
  reason: "SQLITE_ERROR was due to stale local database"
  severity: n/a
  test: 4
  root_cause: "User's local .mastra/mastra.db needed reset after schema change"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Result detail dialog shows View Trace link"
  status: failed
  reason: "User reported: traceId not in API response - server schema missing field"
  severity: major
  test: 6
  root_cause: "Plan 06-10 added traceId to core storage but missed server API schema. runResultResponseSchema in datasets.ts doesn't include traceId."
  artifacts:
  - path: "packages/server/src/server/schemas/datasets.ts"
    issue: "Lines 141-155: runResultResponseSchema missing traceId field"
    missing:
  - "Add traceId: z.string().nullable() to runResultResponseSchema"
    debug_session: ""
