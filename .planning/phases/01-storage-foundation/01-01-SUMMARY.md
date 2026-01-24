---
phase: 01-storage-foundation
plan: 01
subsystem: database
tags: [storage, types, datasets, schema, typescript]

# Dependency graph
requires: []
provides:
  - Dataset and DatasetItem type definitions
  - DATASETS_SCHEMA and DATASET_ITEMS_SCHEMA table schemas
  - DatasetsStorage abstract base class with CRUD contract
affects: [01-02, 01-03, 02-run-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Timestamp-based versioning (Langfuse pattern) for datasets
    - Abstract storage domain class with concrete implementations

key-files:
  created:
    - packages/core/src/storage/domains/datasets/base.ts
    - packages/core/src/storage/domains/datasets/index.ts
  modified:
    - packages/core/src/storage/types.ts
    - packages/core/src/storage/constants.ts
    - packages/core/src/storage/domains/operations/inmemory.ts

key-decisions:
  - "Timestamp-based versioning (version field is Date) following Langfuse pattern"
  - "input/expectedOutput as unknown type - flexible for any JSON structure"
  - "Abstract base class pattern following existing ScoresStorage/StorageDomain"

patterns-established:
  - "DatasetsStorage follows ScoresStorage pattern: abstract class with CRUD methods"
  - "Table schemas follow AGENTS_SCHEMA/SCORERS_SCHEMA pattern in constants.ts"

# Metrics
duration: 8min
completed: 2026-01-23
---

# Phase 1 Plan 1: Types and Base Class Summary

**Dataset/DatasetItem types with timestamp versioning, table schemas, and DatasetsStorage abstract base class**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-23T21:10:00Z
- **Completed:** 2026-01-23T21:18:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Dataset and DatasetItem interfaces with timestamp-based version field
- Complete CRUD input/output types (Create, Update, List, Add)
- DATASETS_SCHEMA and DATASET_ITEMS_SCHEMA registered in TABLE_SCHEMAS
- DatasetsStorage abstract class with 11 abstract methods

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Dataset types to storage/types.ts** - `23be652a03` (feat)
2. **Task 2: Add table schemas to storage/constants.ts** - `4c57605607` (feat)
3. **Task 3: Create DatasetsStorage base class** - `075d45dc40` (feat)

## Files Created/Modified
- `packages/core/src/storage/types.ts` - Added Dataset, DatasetItem, and all input/output types
- `packages/core/src/storage/constants.ts` - Added TABLE_DATASETS, TABLE_DATASET_ITEMS, schemas
- `packages/core/src/storage/domains/datasets/base.ts` - Abstract DatasetsStorage class
- `packages/core/src/storage/domains/datasets/index.ts` - Re-exports
- `packages/core/src/storage/domains/operations/inmemory.ts` - Added new table maps

## Decisions Made
- Followed existing patterns from ScoresStorage and AGENTS_SCHEMA exactly
- Used timestamp-based versioning (Date type) as per Langfuse pattern from research
- Made input/expectedOutput/context fields use unknown/Record types for flexibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated inmemory.ts to include new tables**
- **Found during:** Task 2 (Add table schemas)
- **Issue:** Adding TABLE_DATASETS and TABLE_DATASET_ITEMS to TABLE_NAMES type caused typecheck failure - inmemory.ts data object was missing these keys
- **Fix:** Added `mastra_datasets: new Map()` and `mastra_dataset_items: new Map()` to inmemory.ts
- **Files modified:** packages/core/src/storage/domains/operations/inmemory.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 4c57605607 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for type safety. No scope creep.

## Issues Encountered
None - plan executed smoothly after blocking issue fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Types and schemas ready for in-memory and LibSQL implementations (01-02, 01-03)
- DatasetsStorage contract defines all methods implementations must fulfill
- No blockers

---
*Phase: 01-storage-foundation*
*Completed: 2026-01-23*
