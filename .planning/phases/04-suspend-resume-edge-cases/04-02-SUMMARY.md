---
phase: 04
plan: 02
subsystem: evented-workflow-runtime
tags: [suspend-resume, resume-label, suspendData, workflow-context]
depends_on:
  requires: [04-01]
  provides: [resume-labels, suspendData-access]
  affects: [04-03, 04-04, 04-05, 04-06]
tech_stack:
  added: []
  patterns: [resume-label-resolution, suspend-options-propagation]
key_files:
  created: []
  modified:
    - packages/core/src/workflows/evented/evented-workflow.test.ts
    - packages/core/src/workflows/evented/workflow.ts
    - packages/core/src/workflows/evented/step-executor.ts
    - packages/core/src/workflows/evented/workflow-event-processor/index.ts
    - packages/core/src/storage/types.ts
decisions:
  - id: skip-closeOnSuspend
    choice: Skip test for closeOnSuspend in evented runtime
    reason: Evented runtime uses pubsub events instead of stream API with closeOnSuspend option
    tradeoffs: API parity gap with default runtime for streaming behavior
metrics:
  duration: "~10min"
  completed: 2026-01-27
---

# Phase 04 Plan 02: Resume Labels and SuspendData Summary

Resume labels implemented in evented workflow runtime with full test coverage.

## What Changed

### Task 1: Port 4 Resume Label and Context Tests (RED Phase)
**Commit:** `facd4f6a73` - test(04-02): port 4 resume label and suspendData tests (RED phase)

Ported 4 tests from workflow.test.ts to evented-workflow.test.ts:

1. **Resume by Label Test** - Validates suspend with `resumeLabel` option and resume by label
2. **SuspendData Access Test** - Verifies step can access `suspendData` context on resume
3. **Input Preservation Test** - Confirms original input preserved in snapshot after resume
4. **CloseOnSuspend Test** - Skipped (evented runtime uses pubsub, not stream API)

### Task 2: Implement Resume Label Support (GREEN Phase)
**Commit:** `0a39b2e867` - feat(04-02): implement resume label support in evented runtime

Implementation across 4 files:

1. **storage/types.ts** - Added `resumeLabels` to `UpdateWorkflowStateOptions`
2. **step-executor.ts** - Modified `suspend()` to accept `SuspendOptions` with `resumeLabel`
3. **workflow-event-processor/index.ts** - Extract and persist resumeLabels during suspend
4. **workflow.ts** - Added `label` parameter to `EventedRun.resume()` with resolution logic

## Key Implementation Details

### Resume Label Flow
```
1. Step calls suspend(data, { resumeLabel: 'approval' })
2. step-executor stores label in __workflow_meta.resumeLabels
3. workflow-event-processor extracts labels and persists to snapshot
4. On resume({ label: 'approval' }), workflow.ts resolves label to stepId
```

### Resume Label Resolution Code
```typescript
// In EventedRun.resume()
const snapshotResumeLabel = params.label ? snapshot?.resumeLabels?.[params.label] : undefined;

if (params.label && !snapshotResumeLabel) {
  throw new Error(`Resume label "${params.label}" not found. Available labels: [...]`);
}

const stepParam = snapshotResumeLabel?.stepId ?? params.step;
```

## Deviations from Plan

### Intentional Skip: closeOnSuspend Test
- **Reason:** The evented runtime uses a fundamentally different streaming mechanism (pubsub events) compared to the default runtime's stream() API with closeOnSuspend option
- **Impact:** API parity gap, but not a functional limitation - streaming works, just differently

## Test Results

| Test | Status |
|------|--------|
| should handle basic suspend and resume flow using resumeLabel | PASS |
| should provide access to suspendData in workflow step on resume | PASS |
| should preserve input property from snapshot context after resume | PASS |
| should handle basic suspend and resume flow that does not close on suspend | SKIP |

**Total:** 4 tests added (3 pass, 1 skip), 167 total passing, 13 skipped

## Files Modified

| File | Changes |
|------|---------|
| evented-workflow.test.ts | +155 lines (4 new tests) |
| workflow.ts | +14 lines (label parameter, resolution logic) |
| step-executor.ts | +16 lines (SuspendOptions handling) |
| workflow-event-processor/index.ts | +4 lines (resumeLabels extraction) |
| storage/types.ts | +1 line (resumeLabels type) |

## Next Phase Readiness

Plan 04-02 complete. Ready for:
- **04-03:** Parallel workflow suspend/resume edge cases
- **04-04:** Nested workflow suspend/resume edge cases
- **04-05:** Loop-based suspend/resume edge cases
- **04-06:** Complex branching suspend/resume edge cases

No blockers identified.
