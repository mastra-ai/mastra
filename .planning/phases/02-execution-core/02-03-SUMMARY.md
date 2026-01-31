---
phase: 02-execution-core
plan: 03
subsystem: execution
tags: [datasets, runs, execution, p-map, scoring, concurrency]

# Dependency graph
requires:
  - phase: 02-execution-core
    provides: RunsStorage domain base (02-01)
  - phase: 01-storage-foundation
    provides: DatasetsStorage for loading items
provides:
  - runDataset() function for executing datasets against targets
  - Target executor for agents and workflows
  - Scorer runner with error isolation
  - Types: RunConfig, ItemResult, RunSummary
affects: [02-04 API routes, Phase 3 comparison infrastructure]

# Tech tracking
tech-stack:
  added: []
  patterns: [p-map concurrency, inline scoring, error isolation]

key-files:
  created:
    - packages/core/src/datasets/run/types.ts
    - packages/core/src/datasets/run/executor.ts
    - packages/core/src/datasets/run/scorer.ts
    - packages/core/src/datasets/run/index.ts
    - packages/core/src/datasets/index.ts
  modified:
    - packages/core/src/storage/base.ts

key-decisions:
  - 'Scorers run inline after each item execution (not batched)'
  - "Error isolation: one scorer failing doesn't affect others"
  - 'Target resolution tries getById first, then getByName fallback'
  - 'Workflow non-success statuses (tripwire, suspended, paused) treated as errors'

patterns-established:
  - 'Dataset execution: load items -> resolve target -> p-map execute -> inline score -> persist'
  - "Score persistence via validateAndSaveScore with source='TEST'"

# Metrics
duration: 5min
completed: 2026-01-24
---

# Phase 2 Plan 03: Run Orchestration Summary

**runDataset() function executing dataset items against targets with p-map concurrency and inline scoring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-24T22:26:13Z
- **Completed:** 2026-01-24T22:31:31Z
- **Tasks:** 4
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- RunConfig interface for dataset execution configuration
- ItemResult/ItemWithScores/RunSummary types for results
- executeTarget() dispatching to agent and workflow handlers
- resolveScorers() resolving mixed array of instances and string IDs
- runScorersForItem() with per-scorer error isolation
- runDataset() orchestrating full execution with p-map concurrency
- AbortSignal support for cancellation
- RunsStorage domain added to StorageDomains type

## Task Commits

Each task was committed atomically:

1. **Task 1: Create run types** - `26c1ef5` (feat)
2. **Task 2: Create target executor** - `b1a52f8` (feat)
3. **Task 3: Create scorer runner** - `1b2a464` (feat)
4. **Task 4: Create main runDataset function** - `76b631c` (feat)

## Files Created/Modified

- `packages/core/src/datasets/run/types.ts` - RunConfig, ItemResult, ScorerResult, ItemWithScores, RunSummary
- `packages/core/src/datasets/run/executor.ts` - executeTarget, executeAgent, executeWorkflow
- `packages/core/src/datasets/run/scorer.ts` - resolveScorers, runScorersForItem, runScorerSafe
- `packages/core/src/datasets/run/index.ts` - runDataset main function, resolveTarget helper
- `packages/core/src/datasets/index.ts` - Export barrel
- `packages/core/src/storage/base.ts` - Added runs domain to StorageDomains type

## Decisions Made

- Inline scoring: scorers run immediately after each item execution, not batched
- Error isolation: failing scorer doesn't affect other scorers or item results
- Target fallback: resolve by ID first, then by name if ID fails
- Workflow errors: tripwire, suspended, paused all treated as execution errors
- Score persistence: best-effort (logged warning, no failure)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added runs to StorageDomains type**

- **Found during:** Task 4
- **Issue:** `getStore('runs')` failed because `runs` not in StorageDomains
- **Fix:** Added `runs?: RunsStorage` to StorageDomains in storage/base.ts
- **Files modified:** packages/core/src/storage/base.ts
- **Committed in:** 76b631c (Task 4 commit)

**2. [Rule 1 - Bug] Fixed workflow result type handling**

- **Found during:** Task 2
- **Issue:** Workflow result can be tripwire/suspended/paused, not just success/failed
- **Fix:** Added explicit handling for all workflow result statuses
- **Files modified:** packages/core/src/datasets/run/executor.ts
- **Committed in:** b1a52f8 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed scorer result type extraction**

- **Found during:** Task 3
- **Issue:** Scorer.run() return type uses complex generics, direct property access fails
- **Fix:** Cast through `any` and validate with typeof checks
- **Files modified:** packages/core/src/datasets/run/scorer.ts
- **Committed in:** 1b2a464 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** Type fixes required for compilation. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- runDataset() ready for integration with API routes (02-04)
- Types exported from packages/core/src/datasets
- Storage domains complete for dataset execution
- Scoring infrastructure integrated with validateAndSaveScore

---

_Phase: 02-execution-core_
_Completed: 2026-01-24_
