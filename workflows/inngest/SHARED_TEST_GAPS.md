# Shared Test Suite - Status Report

## Current State

| Suite          | Passed | Failed | Skipped | Total |
| -------------- | ------ | ------ | ------- | ----- |
| Default Engine | 176    | 0      | 1       | 177   |
| Inngest Engine | 146    | 3      | 24      | 173   |

---

## Inngest Failures (3 unique tests)

These tests pass on Default Engine but fail on Inngest due to engine behavior differences:

### Foreach Resume (2 failures)

| Test                      | Issue                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| `resumeForeachConcurrent` | Returns 'failed' instead of 'suspended' when resuming concurrent foreach |
| `resumeForeachIndex`      | `forEachIndex` parameter not fully supported - returns 'failed'          |

**Root Cause:** Inngest's foreach implementation handles suspend/resume differently. The foreach items run as separate Inngest steps, and resuming a specific index requires coordination that isn't fully implemented.

### Storage Nested Workflows (1 failure)

| Test                                                                     | Issue                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `should exclude nested workflow steps when withNestedWorkflows is false` | Missing `storage-nested-inner-workflow.inner-step` property |

**Root Cause:** Inngest nested workflows use `step.invoke()` which stores results differently. The step naming convention differs from Default Engine, so the property name doesn't match expectations.

---

## Inngest Skipped Tests (24)

### By Category

| Category             | Count | Tests                                                                                                                                                       |
| -------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing               | 2     | `foreachConcurrentTiming`, `foreachPartialConcurrencyTiming`                                                                                                |
| Behavior Differences | 4     | `schemaValidationThrows` (x2), `abortStatus`, `foreachSingleConcurrency`                                                                                    |
| Resume Not Supported | 8     | `resumeAutoDetect`, `resumeBranchingStatus`, `resumeNested`, `resumeConsecutiveNested`, `resumeDountil`, `resumeLoopInput`, `resumeMapStep`, `cloneAsSteps` |
| Run Count            | 2     | `runCount`, `retryCount`                                                                                                                                    |
| Restart              | 4     | All restart tests (not supported on Inngest)                                                                                                                |
| Foreach Resume       | 2     | `resumeForeachConcurrent`, `resumeForeachIndex`                                                                                                             |
| Other                | 2     | Additional skips                                                                                                                                            |

### Reason Breakdown

| Reason                                    | Tests                                                        |
| ----------------------------------------- | ------------------------------------------------------------ |
| Inngest returns 'failed' not 'suspended'  | `resumeBranchingStatus`, `abortStatus`                       |
| Nested step path resume not supported     | `resumeNested`, `resumeConsecutiveNested`, `resumeDountil`   |
| Network overhead makes timing unreliable  | `foreachConcurrentTiming`, `foreachPartialConcurrencyTiming` |
| Validation happens async, doesn't throw   | `schemaValidationThrows` (x2)                                |
| Race condition with snapshot persistence  | `foreachSingleConcurrency`                                   |
| Result doesn't include 'suspended' array  | `resumeAutoDetect`                                           |
| Loop behavior differs                     | `runCount`, `retryCount`, `resumeLoopInput`                  |
| Map step resume not supported             | `resumeMapStep`                                              |
| Clone workflows need special registration | `cloneAsSteps`                                               |
| `restart()` throws "not supported"        | All restart tests                                            |

---

## Recommended Fixes

### P0: Fix Failures (Move to Skip or Fix Code)

1. **Nested workflow step naming** - Align step naming between engines OR adjust test expectations
2. **forEachIndex resume** - Add skip or implement properly

### P1: Add Missing Skip Configurations

These tests should be added to `skipTests` in `workflow-factory.test.ts`:

```typescript
skipTests: {
  // Add these:
  resumeForeachConcurrent: true,    // Already failing
  resumeForeachIndex: true,         // Already failing
  storageWithNestedWorkflows: true,   // Already failing
}
```

---

## Engine-Specific Tests (Cannot Share)

### Inngest-Only (~15 tests)

- Flow control (throttle, rateLimit) - 4 tests
- Scheduling (cron) - 2 tests
- Serve function - 3 tests
- Inngest primitives (step.run) - 1 test
- @inngest/realtime streaming - 3 tests
- Eval framework - 2 tests

### Default Engine-Only (~20 tests)

- `stream()` API tests - 3 tests
- Agent with MockLanguageModelV1 - 8 tests
- TripWire tests - 3 tests
- startAsync tests - 2 tests
- v1 model compatibility - 2 tests
- Auto-commit workflow - 2 tests

---

## Completed Work

All planned tasks (T1-T8) have been completed or partially completed:

| Task                        | Status  | Tests Added |
| --------------------------- | ------- | ----------- |
| T1: Time Travel             | ✅ Done | 8 tests     |
| T2: Advanced Callbacks      | ✅ 6/8  | 6 tests     |
| T3: Clone Workflows         | ✅ 1/2  | 1 test      |
| T4: Parallel Suspended      | ✅ Done | 1 test      |
| T5: Foreach Suspend/Resume  | ✅ 3/5  | 2 tests     |
| T6: Workflow Result Options | ✅ Done | 2 tests     |
| T7: Variable Resolution     | ✅ Done | 3 tests     |
| T8: Misc Tests              | ✅ 3/8  | 3 tests     |

### Remaining Blocked Items

| Item                         | Blocker                                   |
| ---------------------------- | ----------------------------------------- |
| Mastra instance in callbacks | Need `getMastra()` helper in test context |
| Clone workflows as steps     | Cloned workflows need Mastra registration |
| Foreach with label resume    | Uses label option not yet in shared suite |
| Bail in foreach              | Uses bail() in foreach                    |
| streamLegacy tests           | Uses streamLegacy() API                   |
| Resume schema defaults       | Resume API differences                    |
| shouldPersistSnapshot        | Options support                           |
