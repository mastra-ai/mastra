---
phase: 06-playground-integration
plan: 09
subsystem: ui
tags: [react, tanstack-query, scores, hooks]

# Dependency graph
requires:
  - phase: 05-run-analytics
    provides: listScoresByRunId API endpoint
  - phase: 06-playground-integration
    provides: ResultsTable component with scores prop
provides:
  - useScoresByRunId hook for fetching scores by run
  - Scores display in run results view
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useScoresByRunId transforms flat scores to Record<itemId, ScoreData[]>

key-files:
  created: []
  modified:
    - packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts
    - packages/playground/src/pages/datasets/dataset/run/index.tsx

key-decisions:
  - 'Group scores by entityId (itemId) for ResultsTable consumption'
  - 'Default to empty object when scores not yet loaded'

patterns-established:
  - 'Score hooks transform API response to component-friendly shape'

# Metrics
duration: 2min
completed: 2026-01-26
---

# Phase 6 Plan 9: Scores Display Summary

**useScoresByRunId hook fetches scores from API and groups by itemId for ResultsTable display**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-26T22:20:13Z
- **Completed:** 2026-01-26T22:21:58Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added useScoresByRunId hook to fetch and transform scores
- Wired hook to run page, replacing placeholder empty object
- Run results now display actual scores from API

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useScoresByRunId hook and wire to run page** - `77f8b1b0bd` (feat)

## Files Created/Modified

- `packages/playground-ui/src/domains/datasets/hooks/use-dataset-runs.ts` - Added useScoresByRunId hook
- `packages/playground/src/pages/datasets/dataset/run/index.tsx` - Import and use hook, remove placeholder

## Decisions Made

- Group scores by entityId which maps to itemId for ResultsTable
- Include id field in transformed scores (required by ScoreData interface)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT test 15 (scores display) should now pass
- Scores visible in run results for each item

---

_Phase: 06-playground-integration_
_Completed: 2026-01-26_
