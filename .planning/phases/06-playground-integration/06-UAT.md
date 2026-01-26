---
status: diagnosed
phase: 06-playground-integration
source: [06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md]
started: 2026-01-26T19:30:00Z
updated: 2026-01-26T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar Navigation
expected: Datasets link appears in sidebar under Observability section. Clicking navigates to /datasets.
result: pass

### 2. Empty Datasets State
expected: /datasets page shows empty state with "No datasets" message and Create Dataset button.
result: pass

### 3. Create Dataset Dialog
expected: Create Dataset button opens dialog with name (required) and description (optional) fields. Submitting creates dataset and shows success toast.
result: pass

### 4. Datasets List Display
expected: After creating dataset, /datasets shows table with Name, Version, and Created columns. Row click navigates to dataset detail.
result: issue
reported: "I get a No items yet message with a create item button however nothing happens, no request is being made and no modal pops up. I do see some 500 network requests: GET http://localhost:4111/api/datasets/64d4646b-f2ab-41f6-aa2e-a1a7a05c56c7/runs 500 (Internal Server Error)"
severity: major

### 5. Dataset Detail Page
expected: /datasets/:id shows dataset name in header, tabbed view with Items and Run History tabs.
result: pass

### 6. Run Trigger Dialog
expected: "Run" button opens dialog with target type selector (Agent/Workflow/Scorer). After selecting type, specific target dropdown appears. Optional scorer selection shown for Agent/Workflow.
result: pass

### 7. Run History Display
expected: Run History tab shows table with status badge, target info, created date, and checkbox for comparison selection.
result: pass

### 8. Run Results View
expected: /datasets/:id/runs/:runId shows results table with item ID, input preview, output preview, scores, and status. Row click opens side dialog with full details.
result: issue
reported: "I can't view the run, I will only toggle the checkbox"
severity: major

### 9. Comparison Selection
expected: Selecting exactly 2 runs via checkboxes in Run History enables Compare button. Clicking navigates to comparison view.
result: pass

### 10. Comparison View
expected: /datasets/:id/compare?runA=x&runB=y shows side-by-side comparison with score deltas. Regression indicators show arrows and colors (red for regression, green for improvement).
result: pass

### 11. Dataset Edit/Delete
expected: Dataset list or detail page has edit/delete actions for datasets
result: issue
reported: "No button to edit or delete a dataset"
severity: major

### 12. Item Edit/Delete
expected: Items list has edit/delete actions for individual items
result: issue
reported: "No button to edit or delete a dataset item"
severity: major

### 13. Add Item After Initial
expected: After creating first item, Add Item button remains visible to add more items
result: issue
reported: "There is no add item button after I created an initial item"
severity: major

### 14. Async Run Trigger
expected: Run trigger returns immediately, run executes in background with status polling
result: issue
reported: "When triggering a run it looks like the call is made synchronous instead of asynchronous"
severity: major

### 15. Score Display in Results
expected: Dataset item results show scores from scorers with values and labels
result: issue
reported: "Dataset item results are not displaying scores properly"
severity: major

### 16. Trace Links in Results
expected: Dataset item result view includes link to trace for debugging execution
result: issue
reported: "When seeing a dataset item result I would like to see traces as well"
severity: minor

## Summary

total: 16
passed: 8
issues: 8
pending: 0
skipped: 0

## Gaps

- truth: "Create Item button works and 500 error on runs endpoint is resolved"
  status: fixed
  reason: "User reported: Create Item button does nothing (no request, no modal). 500 error on GET /api/datasets/:id/runs"
  severity: major
  test: 4
  root_cause: "Fixed by user"
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Run row click navigates to /datasets/:id/runs/:runId with results view"
  status: fixed
  reason: "User reported: I can't view the run, I will only toggle the checkbox"
  severity: major
  test: 8
  root_cause: "Row onClick handler only calls toggleRunSelection(run.id) - no navigation logic exists"
  artifacts:
    - path: "packages/playground-ui/src/domains/datasets/components/dataset-detail/run-history.tsx"
      issue: "Line 125 onClick only toggles checkbox, no navigation to run details"
  missing:
    - "Add navigation to /datasets/:id/runs/:runId on row click (not checkbox)"
  fix: "Changed row onClick to navigate(), checkbox stopPropagation already handles selection"
  debug_session: ""

- truth: "Dataset list or detail page has edit/delete actions"
  status: failed
  reason: "User reported: No button to edit or delete a dataset"
  severity: major
  test: 11
  root_cause: "DatasetDetail accepts onEditClick/onDeleteClick callbacks but playground page doesn't pass them. Buttons only render when callbacks provided."
  artifacts:
    - path: "packages/playground/src/pages/datasets/dataset/index.tsx"
      issue: "Missing onEditClick/onDeleteClick callback props"
    - path: "packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-detail.tsx"
      issue: "Has button UI (lines 76-91) but conditionally rendered"
  missing:
    - "Create EditDatasetDialog and DeleteDatasetDialog components"
    - "Wire up callbacks in playground page like existing dialogs"
  debug_session: ".planning/debug/dataset-edit-delete.md"

- truth: "Items list has edit/delete actions for individual items"
  status: failed
  reason: "User reported: No button to edit or delete a dataset item"
  severity: major
  test: 12
  root_cause: "ItemsList table rows render only data cells, no actions column. Mutations exist in useDatasetMutations but UI never implemented."
  artifacts:
    - path: "packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx"
      issue: "Line 55-66: Row renders only data, no actions column"
    - path: "packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts"
      issue: "updateItem/deleteItem mutations exist but unused"
  missing:
    - "Add Actions column to ItemsList table"
    - "Add edit/delete icon buttons per row"
    - "Wire to existing mutations"
    - "Add AlertDialog for delete confirmation"
  debug_session: ".planning/debug/item-edit-delete.md"

- truth: "Add Item button visible after creating first item"
  status: failed
  reason: "User reported: There is no add item button after I created an initial item"
  severity: major
  test: 13
  root_cause: "Add Item button only rendered in EmptyItemsList component (when items.length === 0). Populated table has no Add Item button."
  artifacts:
    - path: "packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx"
      issue: "Line 42-44: early return to EmptyItemsList when empty; Line 46-71: populated table has no button"
  missing:
    - "Add button to header area or above items table when items exist"
  debug_session: ".planning/debug/add-item-button-missing.md"

- truth: "Run trigger is asynchronous with status polling"
  status: failed
  reason: "User reported: Run trigger appears synchronous instead of async"
  severity: major
  test: 14
  root_cause: "Server handler awaits full runDataset() execution inline. No background job queue. UI polling exists but never sees pending state."
  artifacts:
    - path: "packages/server/src/server/handlers/datasets.ts"
      issue: "Line 463: await runDataset() blocks until complete"
    - path: "packages/core/src/datasets/run/index.ts"
      issue: "runDataset() is blocking, processes all items before returning"
  missing:
    - "Server should create run record with pending status"
    - "Spawn runDataset() without await, return runId immediately"
    - "UI polling (useDatasetRun) will handle status transitions"
  debug_session: ".planning/debug/run-trigger-sync.md"

- truth: "Dataset item results display scores properly"
  status: failed
  reason: "User reported: Dataset item results are not displaying scores properly"
  severity: major
  test: 15
  root_cause: "Scores never fetched - run detail page passes empty object {} as scores. API client.listScoresByRunId() exists but not called."
  artifacts:
    - path: "packages/playground/src/pages/datasets/dataset/run/index.tsx"
      issue: "Line 83-84: const scores = {} with comment 'Placeholder for scores'"
    - path: "packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts"
      issue: "Missing useScoresByRunId hook"
  missing:
    - "Add useScoresByRunId hook wrapping client.listScoresByRunId()"
    - "Transform flat scores array to Record<itemId, ScoreData[]>"
    - "Use hook in run detail page"
  debug_session: ".planning/debug/scores-display.md"

- truth: "Dataset item result view includes trace links"
  status: failed
  reason: "User reported: Want to see traces in dataset item results"
  severity: minor
  test: 16
  root_cause: "traceId available from agent/workflow execution but never captured or stored. ExecutionResult interface only has output/error. Schema has no traceId column."
  artifacts:
    - path: "packages/core/src/datasets/run/executor.ts"
      issue: "Line 16-21: ExecutionResult missing traceId"
    - path: "packages/core/src/datasets/run/index.ts"
      issue: "Line 122-146: Not capturing traceId from results"
    - path: "packages/core/src/storage/constants.ts"
      issue: "Line 169-183: DATASET_RUN_RESULTS_SCHEMA missing traceId column"
  missing:
    - "Add traceId to ExecutionResult interface"
    - "Capture traceId from agent/workflow results"
    - "Add traceId column to storage schema"
    - "Propagate to UI and display trace link"
  debug_session: ".planning/debug/trace-links.md"
