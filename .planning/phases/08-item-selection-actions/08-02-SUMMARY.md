---
phase: 08
plan: 02
subsystem: playground-ui
tags: [popover, mutation, bulk-delete, ui-component]
dependency-graph:
  requires: [08-01]
  provides: [ActionsMenu component, deleteItems mutation]
  affects: [08-03, 08-04]
tech-stack:
  added: []
  patterns: [popover-menu, bulk-mutation]
file-tracking:
  key-files:
    created:
      - packages/playground-ui/src/domains/datasets/components/dataset-detail/items-list-actions.tsx
    modified:
      - packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts
      - packages/playground-ui/src/domains/datasets/index.ts
decisions: []
metrics:
  duration: 3 min
  completed: 2026-01-27
---

# Phase 08 Plan 02: Actions Menu & Bulk Delete Summary

**TL;DR:** Three-dot popover menu with Export/Create Dataset/Delete options + bulk delete mutation for sequential item deletion.

## What Was Built

### ActionsMenu Component

- Popover-based menu triggered by MoreVertical (three-dot) icon
- Three action buttons: Export, Create Dataset, Delete
- Delete styled red (`text-red-500 hover:text-red-400`) for destructive emphasis
- `disabled` prop disables trigger when no items selected
- Auto-closes popover after action invoked

### deleteItems Bulk Mutation

- Sequential deletion via for-loop (no bulk API endpoint exists)
- Accepts `{ datasetId, itemIds: string[] }`
- Invalidates `dataset-items` and `dataset` queries on success
- Added to `useDatasetMutations` return object

## Commits

| Hash       | Type  | Description                                |
| ---------- | ----- | ------------------------------------------ |
| 7453d06d1c | feat  | ActionsMenu component with popover pattern |
| dbcb098075 | feat  | deleteItems bulk mutation                  |
| fb3438d7dc | chore | Export ActionsMenu from index              |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeCheck: Pass
- Build: Pass
- ActionsMenu exported in .d.ts
- deleteItems exported in .d.ts

## Next Phase Readiness

**Blockers:** None

**Dependencies for 08-03:**

- ActionsMenu component available for integration
- deleteItems mutation ready for wiring

**Open questions:** None
