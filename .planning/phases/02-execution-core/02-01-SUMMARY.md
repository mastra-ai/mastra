---
phase: 02-execution-core
plan: 01
subsystem: database
tags: [storage, runs, types, schemas, abstract-class]

# Dependency graph
requires:
  - phase: 01-storage-foundation
    provides: DatasetsStorage pattern, StorageDomain base class, TABLE_SCHEMAS pattern
provides:
  - Run and RunResult types for execution tracking
  - TABLE_DATASET_RUNS and TABLE_DATASET_RUN_RESULTS schemas
  - RunsStorage abstract base class with 9 methods
affects: [02-02 inmemory adapter, 02-03 pg adapter, run execution engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [domain storage abstract class, table schema registration]

key-files:
  created:
    - packages/core/src/storage/domains/runs/base.ts
    - packages/core/src/storage/domains/runs/index.ts
  modified:
    - packages/core/src/storage/types.ts
    - packages/core/src/storage/constants.ts
    - packages/core/src/storage/domains/inmemory-db.ts
    - packages/core/src/storage/domains/operations/inmemory.ts

key-decisions:
  - 'RunsStorage follows DatasetsStorage/ScoresStorage pattern'
  - 'Run tracks overall execution state, RunResult tracks per-item results'
  - 'latency stored as number (ms) with float column type'

patterns-established:
  - 'Storage domain: abstract class with dangerouslyClearAll() and domain-specific methods'
  - 'Table schemas: Record<string, StorageColumn> registered in TABLE_SCHEMAS'

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 2 Plan 01: RunsStorage Domain Base Summary

**Run and RunResult types, table schemas, and RunsStorage abstract class for dataset execution tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T06:00:00Z
- **Completed:** 2026-01-24T06:04:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Run interface with 14 fields tracking overall run state (dataset version, target, status, counts)
- RunResult interface with 13 fields tracking per-item execution (input/output, latency, error)
- CRUD input/output types for all RunsStorage methods
- Table schemas registered in TABLE_SCHEMAS for both tables
- RunsStorage abstract class with 9 methods (5 run lifecycle, 4 result operations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Run types to storage/types.ts** - `c7b5f12` (feat)
2. **Task 2: Add table schemas to storage/constants.ts** - `27c295f` (feat)
3. **Task 3: Create RunsStorage abstract base class** - `ec9ce83` (feat)

## Files Created/Modified

- `packages/core/src/storage/types.ts` - Run, RunResult interfaces + CRUD types
- `packages/core/src/storage/constants.ts` - TABLE_DATASET_RUNS, TABLE_DATASET_RUN_RESULTS schemas
- `packages/core/src/storage/domains/runs/base.ts` - RunsStorage abstract class
- `packages/core/src/storage/domains/runs/index.ts` - Export barrel
- `packages/core/src/storage/domains/inmemory-db.ts` - Added runs/runResults Maps
- `packages/core/src/storage/domains/operations/inmemory.ts` - Added table Maps for type safety

## Decisions Made

- Followed existing DatasetsStorage/ScoresStorage patterns exactly
- Used PaginationInfo (not StoragePaginationResult) to match ListDatasetsOutput pattern
- Added latency as float type (milliseconds precision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added operations/inmemory.ts table entries**

- **Found during:** Task 2 (schema registration)
- **Issue:** TABLE_NAMES type union includes new tables, but StoreOperationsInMemory.data object missing them
- **Fix:** Added mastra_dataset_runs and mastra_dataset_run_results Maps to data object
- **Files modified:** packages/core/src/storage/domains/operations/inmemory.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 27c295f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type safety fix required for compilation. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RunsStorage contract ready for InMemory adapter implementation (02-02)
- Types exported and available for import
- Schemas registered for table creation

---

_Phase: 02-execution-core_
_Completed: 2026-01-24_
