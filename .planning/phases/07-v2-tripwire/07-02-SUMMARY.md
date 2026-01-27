---
phase: 07-v2-tripwire
plan: 02
subsystem: workflows
tags: [evented-workflow, tripwire, v2-model, structured-output, agent-step]

# Dependency graph
requires:
  - phase: 07-01
    provides: V2 model detection, TripWire catching in StepExecutor
provides:
  - TripWire status propagation from step results to workflow results
  - Tripwire chunk detection in agent step stream consumption
  - Structured output capture in agent steps
affects: [07-03, agent-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tripwire chunk detection in stream consumption loop
    - Structured output capture via onFinish callback

key-files:
  created: []
  modified:
    - packages/core/src/workflows/evented/execution-engine.ts
    - packages/core/src/workflows/evented/workflow.ts
    - packages/core/src/workflows/evented/evented-workflow.test.ts

key-decisions:
  - "Use (chunk as any).type === 'tripwire' cast because tripwire is runtime addition not in base type"
  - "Capture structured output in onFinish callback, same pattern as default runtime"

patterns-established:
  - "Tripwire detection: scan step results for tripwire field in failed steps"
  - "Agent step tripwire: check for tripwire chunks in stream, throw TripWire if found"
  - "Structured output: capture via onFinish callback, return if available"

# Metrics
duration: 16min
completed: 2026-01-27
---

# Phase 7 Plan 02: TripWire Status Propagation Summary

**TripWire status propagation from step results to workflow results, tripwire chunk detection and structured output support in agent steps**

## Performance

- **Duration:** 16 min
- **Started:** 2026-01-27T20:52:36Z
- **Completed:** 2026-01-27T21:09:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- EventedExecutionEngine detects tripwire in step results and sets workflow status to 'tripwire'
- Agent steps detect tripwire chunks in stream and throw TripWire errors
- Agent steps capture and return structured output when available
- 4 previously-skipped tests now pass (V2 model + TripWire tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TripWire status propagation in EventedExecutionEngine** - `b14582255d` (feat)
2. **Task 2: Unskip and verify V2 model and TripWire tests** - `bf70bc180b` (feat)

## Files Created/Modified

- `packages/core/src/workflows/evented/execution-engine.ts` - Added tripwire detection in step results, tripwire status propagation
- `packages/core/src/workflows/evented/workflow.ts` - Added tripwire chunk detection and structured output capture in createStepFromAgent
- `packages/core/src/workflows/evented/evented-workflow.test.ts` - Unskipped 4 tests

## Decisions Made

1. **Cast chunk to any for tripwire type check** - The fullStream types don't include 'tripwire' in their union, but it's added at runtime by agent processors
2. **Follow default runtime pattern for structured output** - Use onFinish callback to capture result.object, same as workflow.ts implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added tripwire chunk detection in agent step stream consumption**
- **Found during:** Task 2 (test execution revealed agent steps weren't detecting tripwire)
- **Issue:** Agent steps iterated stream without checking for tripwire chunks, so TripWire errors weren't being thrown
- **Fix:** Added tripwireChunk variable, check for chunk.type === 'tripwire', throw TripWire if found (both V2 and V1 paths)
- **Files modified:** packages/core/src/workflows/evented/workflow.ts
- **Verification:** Tripwire tests pass
- **Committed in:** bf70bc180b (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added structured output capture in agent steps**
- **Found during:** Task 2 (structured output test was failing)
- **Issue:** Agent steps returned `{ text }` always, not capturing structured output from onFinish
- **Fix:** Added onFinish callback to capture result.object when structuredOutput.schema is set, return structuredResult if available
- **Files modified:** packages/core/src/workflows/evented/workflow.ts
- **Verification:** Structured output test passes
- **Committed in:** bf70bc180b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes essential for test parity with default runtime. No scope creep.

## Issues Encountered

None - once the missing tripwire chunk detection and structured output capture were identified, the fixes were straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TripWire propagation complete from step execution through to workflow result
- 4 V2 model + TripWire tests now pass
- Ready for 07-03: Final validation and edge cases

---
*Phase: 07-v2-tripwire*
*Completed: 2026-01-27*
