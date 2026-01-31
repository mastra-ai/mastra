---
status: diagnosed
trigger: 'Create Item button does nothing, 500 error on runs endpoint'
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes found
test: Code review complete
expecting: N/A
next_action: Return diagnosis

## Symptoms

expected: Create Item shows modal, runs endpoint returns data
actual: Button does nothing, runs returns 500
errors: 500 on GET /api/datasets/:datasetId/runs
reproduction: Navigate to /datasets/:id, click Create Item
started: Current state

## Eliminated

## Evidence

- timestamp: 2026-01-26T00:00:30Z
  checked: packages/playground/src/pages/datasets/dataset/index.tsx
  found: DatasetDetail component used without onAddItemClick prop
  implication: Button has onClick but callback is empty `() => {}`

- timestamp: 2026-01-26T00:00:40Z
  checked: packages/playground-ui/src/domains/datasets/components/dataset-detail/dataset-detail.tsx
  found: Line 117 - `onAddClick={onAddItemClick ?? (() => {})}`
  implication: When onAddItemClick not passed, callback is no-op

- timestamp: 2026-01-26T00:00:50Z
  checked: packages/playground-ui/src/domains/datasets (glob for dialogs)
  found: No AddItemDialog or CreateItemDialog component exists
  implication: Dialog component not yet implemented

- timestamp: 2026-01-26T00:01:00Z
  checked: packages/core/src/storage/base.ts line 197-204
  found: stores composition missing 'runs' domain
  implication: getStore('runs') returns undefined, causing 500

## Resolution

root_cause: |
TWO ISSUES:

1. Create Item button: No AddItemDialog exists, and page doesn't pass onAddItemClick
2. Runs 500: MastraCompositeStore.stores composition missing 'runs' domain (line 204)

fix: |

1. Create AddItemDialog component in playground-ui
2. Add 'runs' to stores composition in base.ts line 204

verification:
files_changed: []
