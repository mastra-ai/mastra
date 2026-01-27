---
phase: 07-v2-tripwire
plan: 01
subsystem: workflows
tags: [evented-workflow, v2-model, tripwire, agent-step, streaming]

# Dependency graph
requires:
  - phase: 06-vnext-streaming
    provides: Evented workflow streaming infrastructure
provides:
  - V2 model detection in agent steps via isSupportedLanguageModel
  - .stream() for V2+ models, .streamLegacy() fallback for V1
  - TripWire error catching and serialization in StepExecutor
affects: [07-02, 07-03, agent-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - V2 model branching pattern for agent steps
    - TripWire serialization pattern for workflow status propagation

key-files:
  created: []
  modified:
    - packages/core/src/workflows/evented/workflow.ts
    - packages/core/src/workflows/evented/step-executor.ts

key-decisions:
  - "Use isSupportedLanguageModel to detect V2+ models before calling .stream()"
  - "Check original error not errorInstance for TripWire instanceof"

patterns-established:
  - "V2 model detection: llm.getModel() + isSupportedLanguageModel() before stream method selection"
  - "TripWire serialization: explicit fields { reason, retry, metadata, processorId } for workflow status"

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 7 Plan 01: V2 Model + TripWire Foundation Summary

**V2 model detection in agent steps with isSupportedLanguageModel branching, TripWire error catching with explicit field serialization**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T14:30:00Z
- **Completed:** 2026-01-27T14:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Agent steps now detect V2+ models via `isSupportedLanguageModel` check
- Agent steps use `.stream()` for V2+ models returning MastraModelOutput
- V1 models fall back to `.streamLegacy()` for backwards compatibility
- StepExecutor catches TripWire errors and serializes them with explicit fields
- TripWire serialization preserves reason, retry, metadata, and processorId

## Task Commits

Each task was committed atomically:

1. **Task 1: Add V2 model detection and branching in createStepFromAgent** - `cfa65cf` (feat)
2. **Task 2: Add TripWire catching and serialization in StepExecutor** - `a80df0d` (feat)

## Files Created/Modified

- `packages/core/src/workflows/evented/workflow.ts` - Added isSupportedLanguageModel import, V2 model detection, branching to .stream() or .streamLegacy()
- `packages/core/src/workflows/evented/step-executor.ts` - Added TripWire import, tripwire error detection and serialization in catch block

## Decisions Made

1. **V2 chunk format uses payload.text not textDelta** - The MastraModelOutput fullStream uses `chunk.payload.text` for text-delta chunks, unlike streamLegacy which uses `chunk.textDelta`
2. **Check original error for TripWire instanceof** - getErrorFromUnknown converts errors and loses prototype chain, so must check `error instanceof TripWire` not `errorInstance instanceof TripWire`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed V2 chunk format access**
- **Found during:** Task 1 (V2 model branching)
- **Issue:** Initial implementation used `chunk.textDelta` but V2 MastraModelOutput uses `chunk.payload.text`
- **Fix:** Changed to access `chunk.payload.text` for text-delta chunks
- **Files modified:** packages/core/src/workflows/evented/workflow.ts
- **Verification:** Build succeeded after fix
- **Committed in:** cfa65cf (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Bug fix necessary for V2 model stream handling. No scope creep.

## Issues Encountered

None - plan executed with one minor type error that was caught by TypeScript and fixed immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- V2 model detection foundation complete
- TripWire catching infrastructure ready
- Ready for 07-02 (stream consumption loop with tripwire chunk handling)
- Ready for 07-03 (testing V2 model + TripWire integration)

---
*Phase: 07-v2-tripwire*
*Completed: 2026-01-27*
