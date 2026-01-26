---
status: diagnosed
trigger: "UAT Test 4 - Create Item button does nothing, 500 error on runs endpoint"
created: 2026-01-26T12:00:00Z
updated: 2026-01-26T12:00:00Z
---

## Current Focus

hypothesis: Two separate issues - UI missing button, storage already implemented
test: Code inspection
expecting: Confirm button missing and runs route works
next_action: Report findings

## Symptoms

expected: Create Item button opens dialog; /api/datasets/:id/runs returns runs
actual: Button does nothing (no button visible when items exist); 500 on runs endpoint
errors: 500 error on GET /api/datasets/:id/runs
reproduction: Navigate to dataset detail page with existing items
started: Initial implementation

## Eliminated

- hypothesis: AddItemDialog not exported from playground-ui
  evidence: Confirmed exported in packages/playground-ui/src/domains/datasets/index.ts:18
  timestamp: 2026-01-26

- hypothesis: onAddItemClick not wired in Dataset page
  evidence: packages/playground/src/pages/datasets/dataset/index.tsx:40 passes callback
  timestamp: 2026-01-26

- hypothesis: RunsStorage not implemented in LibSQL
  evidence: stores/libsql/src/storage/domains/runs/index.ts exists with full implementation
  timestamp: 2026-01-26

- hypothesis: runs store not registered in LibSQLStore
  evidence: stores/libsql/src/storage/index.ts:137 creates RunsLibSQL, line 146 assigns to stores
  timestamp: 2026-01-26

## Evidence

- timestamp: 2026-01-26
  checked: packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list.tsx
  found: "Add Item" button ONLY appears in EmptyItemsList component (lines 105-123)
  implication: When items exist, onAddClick is never used - no button rendered

- timestamp: 2026-01-26
  checked: packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-detail.tsx
  found: No "Add Item" button in header area; onAddItemClick passed to ItemsList but ItemsList ignores it when items exist
  implication: Missing UI element for adding items when dataset already has items

- timestamp: 2026-01-26
  checked: packages/server/src/server/handlers/datasets.ts (LIST_RUNS_ROUTE, lines 388-427)
  found: Route calls runsStore.listRuns() - requires runs store to be initialized
  implication: 500 error likely from database tables not initialized (need to call storage.init())

- timestamp: 2026-01-26
  checked: stores/libsql/src/storage/domains/runs/index.ts
  found: RunsLibSQL.init() creates TABLE_DATASET_RUNS and TABLE_DATASET_RUN_RESULTS
  implication: Tables must be created via init() before listRuns works

## Resolution

root_cause: |
  Issue 1 (Create Item button): ItemsList component only renders "Add Item" button when items.length === 0.
  When items exist, the table renders without any button to add more items.

  Issue 2 (500 on runs): Either:
  a) storage.init() not called (tables don't exist)
  b) runsStore returning undefined (check storage config)

fix: pending
verification: pending
files_changed: []
