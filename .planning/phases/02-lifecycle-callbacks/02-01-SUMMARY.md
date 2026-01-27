---
phase: 02-lifecycle-callbacks
plan: 01
subsystem: workflows
tags: [lifecycle, callbacks, onFinish, onError, resourceId, evented]

# Dependency graph
requires:
  - phase: 01-state-object-support
    provides: state object implementation for evented runtime
provides:
  - 15 lifecycle callback context tests ported from default runtime
  - resourceId propagation fix for evented execution engine
  - Test parity for callback context properties (mastra, logger, runId, workflowId, resourceId, requestContext, getInitData)
affects: [02-lifecycle-callbacks, future workflow testing]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/core/src/workflows/evented/evented-workflow.test.ts
    - packages/core/src/workflows/evented/execution-engine.ts
    - packages/core/src/workflows/evented/workflow.ts

key-decisions:
  - "resourceId passed from EventedRun to execute() then to invokeLifecycleCallbacks()"
  - "Test IDs use -evented suffix to avoid conflicts with default runtime tests"

patterns-established:
  - "Evented callback tests: include pubsub, startEventEngine, stopEventEngine"

# Metrics
duration: 6min
completed: 2026-01-27
---

# Phase 02 Plan 01: Lifecycle Callback Context Tests Summary

**15 callback context tests ported with resourceId propagation bug fix - all callbacks now receive mastra, logger, runId, workflowId, resourceId, requestContext, and getInitData**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-27T07:09:00Z
- **Completed:** 2026-01-27T07:15:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Ported 15 lifecycle callback context tests from default runtime to evented runtime
- Fixed resourceId propagation bug in evented execution engine
- Achieved 146 passing tests (131 existing + 15 new)
- All callback context properties now properly passed to onFinish/onError callbacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Port 15 callback context tests** - `2857ea7` (test)
2. **Task 2: Fix resourceId propagation in execution engine** - `d3a9e24` (fix)
3. **Task 3: Verify all 15 tests pass and no regressions** - verification only, no commit needed

## Files Created/Modified
- `packages/core/src/workflows/evented/evented-workflow.test.ts` - Added 15 callback context tests
- `packages/core/src/workflows/evented/execution-engine.ts` - Added resourceId to execute() params, passed to invokeLifecycleCallbacks()
- `packages/core/src/workflows/evented/workflow.ts` - EventedRun.start() now passes resourceId to execute()

## Decisions Made
- Added `resourceId?: string` to EventedExecutionEngine.execute() params type to match base class signature
- Test workflow IDs use `-evented` suffix to avoid conflicts with default runtime tests
- Followed existing evented test patterns: pubsub in Mastra config, startEventEngine/stopEventEngine lifecycle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added resourceId to execute() params type**
- **Found during:** Task 3 (verification)
- **Issue:** TypeScript error - params.resourceId doesn't exist on execute params type
- **Fix:** Added `resourceId?: string` to execute() params type definition
- **Files modified:** packages/core/src/workflows/evented/execution-engine.ts
- **Verification:** pnpm typecheck passes, all tests pass
- **Committed in:** d3a9e24 (amended into Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking type error)
**Impact on plan:** Type fix necessary for compilation. No scope creep.

## Issues Encountered
None - execution proceeded smoothly once resourceId type was added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 15 callback context tests passing
- Test count: 146 passing, 6 skipped (streaming vNext)
- Ready for next plan (02-02: remaining lifecycle callback tests if any)
- Phase 2 may be complete if these 15 tests cover all lifecycle callback gaps

---
*Phase: 02-lifecycle-callbacks*
*Completed: 2026-01-27*
