---
phase: 06-playground-integration
plan: 03
subsystem: ui
tags: [tanstack-query, react, hooks, datasets]

# Dependency graph
requires:
  - phase: 06-playground-integration
    provides: REST API for datasets, items, runs, comparison
provides:
  - TanStack Query hooks for datasets CRUD
  - TanStack Query hooks for run management and polling
  - TanStack Query hooks for run comparison
  - Mutation hooks with cache invalidation
  - Dataset navigation paths in framework
affects: [playground, cloud-studio]

# Tech tracking
tech-stack:
  added: []
  patterns: [TanStack Query polling pattern for active runs, cache invalidation on mutations]

key-files:
  created:
    - packages/playground-ui/src/domains/datasets/index.ts
    - packages/playground-ui/src/domains/datasets/hooks/use-datasets.ts
    - packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts
    - packages/playground-ui/src/domains/datasets/hooks/use-compare-runs.ts
    - packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts
  modified:
    - packages/playground-ui/src/lib/framework.tsx
    - packages/playground-ui/src/index.ts

key-decisions:
  - "useDatasetRun polls every 2s while status is running/pending"
  - "All mutations invalidate relevant query caches on success"
  - "Dataset paths follow existing naming convention (datasetLink, datasetRunLink)"

patterns-established:
  - "Datasets hooks follow agents/workflows domain pattern"
  - "Polling pattern: refetchInterval returns false when complete"

# Metrics
duration: 3min
completed: 2026-01-26
---

# Phase 06 Plan 03: Datasets UI Hooks Summary

**TanStack Query hooks for datasets data fetching with polling and mutation cache invalidation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-26T18:46:51Z
- **Completed:** 2026-01-26T18:49:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Query hooks for datasets, items, runs, and results
- Polling on useDatasetRun while status is running/pending
- Mutation hooks with automatic cache invalidation
- Dataset navigation paths in framework

## Task Commits

Each task was committed atomically:

1. **Task 1: Create datasets domain structure and query hooks** - `5d4b1c3` (feat)
2. **Task 2: Create mutation hooks and update framework paths** - `8b57bd9` (feat)

## Files Created/Modified
- `packages/playground-ui/src/domains/datasets/index.ts` - Domain exports
- `packages/playground-ui/src/domains/datasets/hooks/use-datasets.ts` - useDatasets, useDataset, useDatasetItems
- `packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts` - useDatasetRuns, useDatasetRun, useDatasetRunResults
- `packages/playground-ui/src/domains/datasets/hooks/use-compare-runs.ts` - useCompareRuns
- `packages/playground-ui/src/domains/datasets/hooks/use-dataset-mutations.ts` - useDatasetMutations
- `packages/playground-ui/src/lib/framework.tsx` - Added datasetLink, datasetRunLink paths
- `packages/playground-ui/src/index.ts` - Added datasets domain export

## Decisions Made
- useDatasetRun polls every 2 seconds while status is 'running' or 'pending'
- Mutations invalidate appropriate query keys for cache consistency
- Followed existing domain patterns from agents/workflows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All hooks exported from @mastra/playground-ui
- Ready for UI component development (06-04, 06-05)

---
*Phase: 06-playground-integration*
*Completed: 2026-01-26*
