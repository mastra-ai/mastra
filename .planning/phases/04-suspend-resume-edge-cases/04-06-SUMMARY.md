---
phase: 04-suspend-resume-edge-cases
plan: 06
subsystem: workflows
tags: [foreach, suspend, resume, forEachIndex, concurrency, evented-runtime]

# Dependency graph
requires:
  - phase: 04-01
    provides: Basic suspend/resume edge case infrastructure
  - phase: 04-02
    provides: Resume labels and suspendData support
provides:
  - 6 foreach suspend/resume test cases ported from default runtime (all skipped)
  - Documentation of forEachIndex parameter gap in evented runtime
affects: [05-streaming-vnext, 06-remaining-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/core/src/workflows/evented/evented-workflow.test.ts

key-decisions:
  - "Skip all 6 foreach suspend/resume tests - evented runtime lacks forEachIndex parameter"
  - "Document implementation requirements in test comments for future reference"

patterns-established:
  - "Foreach suspend/resume tests document expected behavior for future implementation"

# Metrics
duration: 4min
completed: 2026-01-27
---

# Phase 4 Plan 6: Foreach Suspend/Resume Summary

**Ported 6 foreach suspend/resume tests from default runtime, all skipped due to evented runtime architectural limitations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T15:36:21Z
- **Completed:** 2026-01-27T15:40:32Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Ported 6 foreach suspend/resume tests from workflow.test.ts to evented-workflow.test.ts
- All tests skipped with clear documentation explaining why
- No regressions - 167 tests still passing, 23 total skipped (6 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Port 6 foreach suspend/resume tests** - `ac51218` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/core/src/workflows/evented/evented-workflow.test.ts` - Added 6 skipped tests for foreach suspend/resume functionality

## Tests Ported

| Test Name | Source Line | Status | Reason |
|-----------|------------|--------|--------|
| should suspend and resume when running a single item concurrency (default) for loop | 7678 | skipped | No forEachIndex in evented runtime |
| should suspend and resume when running all items concurrency for loop | 7844 | skipped | No forEachIndex in evented runtime |
| should suspend and resume provided index when running all items concurrency for loop | 7930 | skipped | No forEachIndex in evented runtime |
| should suspend and resume provided label when running all items concurrency for loop | 8057 | skipped | No forEachIndex in evented runtime |
| should suspend and resume when running a partial item concurrency for loop | 8223 | skipped | No forEachIndex in evented runtime |
| should suspend and resume provided index when running a partial item concurrency for loop | 8314 | skipped | No forEachIndex in evented runtime |

## Decisions Made

1. **Skip all 6 tests rather than implement forEachIndex:**
   - Evented runtime uses event-based execution with executionPath tracking
   - Foreach iterations use pubsub events, not direct function calls
   - Implementing forEachIndex would require:
     - Adding forEachIndex parameter to EventedRun.resume()
     - Tracking suspended iteration indices in the snapshot
     - Modifying loop.ts to handle resume by index
   - This is significant architectural work beyond the scope of porting tests

2. **Document implementation requirements in test comments:**
   - Each test includes comments explaining what it tests from the default runtime
   - The skip block header explains the architectural differences
   - Future implementers can reference these tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward test porting exercise.

## Test Count Update

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Passing | 167 | 167 | 0 |
| Skipped | 17 | 23 | +6 |
| Total | 184 | 190 | +6 |

## Implementation Gap Analysis

The evented runtime's foreach suspend/resume differs from the default runtime:

**Default Runtime:**
- Synchronous execution with direct step calls
- forEachIndex parameter in resume() allows targeting specific iteration
- resumeLabel with foreachIndex tracking for label-based resume
- Multiple suspended iterations tracked in snapshot

**Evented Runtime:**
- Event-based execution via pubsub
- Foreach iterations tracked by executionPath array index
- No forEachIndex parameter in resume() signature
- First suspend stops execution; others not tracked

## Next Phase Readiness

- Phase 4 complete with 16 tests ported (8 passing, 8 skipped)
- Total skipped tests: 23 (6 streaming vNext, 3 schema validation, 14 Phase 4 limitations)
- Ready for Phase 5 (Streaming vNext) or Phase 6 (Remaining Tests)

---
*Phase: 04-suspend-resume-edge-cases*
*Completed: 2026-01-27*
