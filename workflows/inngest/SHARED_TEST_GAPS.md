# Shared Workflow Test Suite - Status Report

## Overview

This document tracks two things:

1. **Test Coverage Gaps** - Tests that exist in original test files but aren't in the shared suite yet
2. **Inngest Compatibility** - Tests in the shared suite that behave differently on Inngest

---

## Current State

| Suite          | Passed | Skipped | Total |
| -------------- | ------ | ------- | ----- |
| Default Engine | 176    | 1       | 177   |
| Inngest Engine | 142    | 31      | 173   |

---

# Part 1: Test Coverage Gaps

These tests exist in the original Inngest test file (`index.test.ts`) but are NOT yet in the shared suite.

## Inngest-Specific (Cannot Share) - ~15 tests

| Category           | Tests                                                         | Why Not Shareable          |
| ------------------ | ------------------------------------------------------------- | -------------------------- |
| Flow Control       | `throttle`, `rateLimit`, `concurrency`, `debounce`            | Inngest-only feature       |
| Scheduling         | `cron schedule`, `cron with initialState`                     | Inngest-only feature       |
| Serve Function     | `merge user functions`, `empty functions`, `no functions`     | `inngestServe()` pattern   |
| Inngest Primitives | `inject inngest step primitives`                              | Direct `step.run()` access |
| Realtime Streaming | `generate stream`, `stream with custom events`, `step events` | `@inngest/realtime`        |
| Eval Framework     | `experiment with workflow target` (x2)                        | Inngest eval framework     |

## Shareable - Not Yet Added

### perStep Mode (~9 tests)

Both engines support `perStep: true` but these tests aren't in shared suite yet.

| Test                                   | Description                       |
| -------------------------------------- | --------------------------------- |
| Execute single step                    | Basic perStep execution           |
| Execute single step in nested workflow | Nested perStep                    |
| Execute one step in parallel           | Parallel with perStep             |
| Follow conditional with perStep        | Conditional chains                |
| Suspend/resume with perStep            | Combined suspend + perStep        |
| TimeTravel with perStep (4 variants)   | TimeTravel + perStep combinations |

### Tracing/Observability (~2 tests)

| Test                                  | Description            |
| ------------------------------------- | ---------------------- |
| `tracingContext.currentSpan` in step  | Access to current span |
| Create child spans from workflow span | Span hierarchy         |

### Sleep Variants (~4 tests)

| Test                            | Description               |
| ------------------------------- | ------------------------- |
| `sleep` with fn parameter       | Dynamic sleep duration    |
| `sleep.until` step              | Sleep until specific time |
| `sleep.until` with fn parameter | Dynamic until time        |

### Misc (~4 tests)

| Test                              | Description              |
| --------------------------------- | ------------------------ |
| `waitForEvent` throws error       | Deprecated API test      |
| Execute multiple runs of workflow | Concurrent run isolation |
| Return correct runId              | RunId consistency        |
| Clone workflows as steps          | Workflow cloning         |

---

# Part 2: Inngest Compatibility

These tests ARE in the shared suite but need to be skipped on Inngest due to behavioral differences.

## Validation Timing (3 tests)

| Test                         | Default Engine                        | Inngest Engine                   |
| ---------------------------- | ------------------------------------- | -------------------------------- |
| `executionFlowNotDefined`    | `createRun()` throws if no steps      | No validation in `createRun()`   |
| `executionGraphNotCommitted` | `createRun()` throws if not committed | No validation in `createRun()`   |
| `schemaValidationThrows`     | Throws synchronously                  | Validation async, returns result |

**Root Cause:** `InngestWorkflow.createRun()` overrides parent without calling validation.

## Suspend/Resume (11 tests)

| Test                      | Default Engine                  | Inngest Engine              |
| ------------------------- | ------------------------------- | --------------------------- |
| `resumeMultiSuspendError` | Result has `suspended[]` array  | No `suspended` array        |
| `resumeAutoDetect`        | Auto-detects from `suspended[]` | No array to detect from     |
| `resumeForeachLoop`       | Individual item suspend/resume  | Different step coordination |
| `resumeForeachConcurrent` | Returns 'suspended'             | Returns 'failed'            |
| `resumeForeachIndex`      | `forEachIndex` works            | Not fully supported         |
| `resumeNested`            | Nested step path works          | Not supported               |
| `resumeConsecutiveNested` | Consecutive nested works        | Not supported               |
| `resumeDountil`           | Dountil loop resume             | Not supported               |
| `resumeLoopInput`         | Loop input tracking             | Not supported               |
| `resumeMapStep`           | Map step resume                 | Not supported               |
| `resumeBranchingStatus`   | Returns 'suspended'             | Returns 'failed'            |

**Root Cause:** Inngest uses step memoization. Complex resume scenarios need coordination not yet implemented.

## Status Values (1 test)

| Test          | Default Engine     | Inngest Engine                |
| ------------- | ------------------ | ----------------------------- |
| `abortStatus` | Returns 'canceled' | Returns 'failed' or 'success' |

**Root Cause:** Inngest cancel mechanism doesn't map to 'canceled' status.

## Storage/Naming (1 test)

| Test                         | Default Engine              | Inngest Engine                       |
| ---------------------------- | --------------------------- | ------------------------------------ |
| `storageWithNestedWorkflows` | Step: `workflow-id.step-id` | Different naming via `step.invoke()` |

**Root Cause:** `step.invoke()` stores results with different key structure.

## Timing (2 tests)

| Test                              | Default Engine | Inngest Engine |
| --------------------------------- | -------------- | -------------- |
| `foreachConcurrentTiming`         | <2000ms        | ~6000ms        |
| `foreachPartialConcurrencyTiming` | <1500ms        | ~7000ms        |

**Root Cause:** Inngest adds 100-500ms network overhead per step.

## Race Conditions (1 test)

| Test                       | Default Engine | Inngest Engine                 |
| -------------------------- | -------------- | ------------------------------ |
| `foreachSingleConcurrency` | Deterministic  | Race with snapshot persistence |

## Unsupported Features (7 tests)

| Test                | Issue                                       |
| ------------------- | ------------------------------------------- |
| `restart` (4 tests) | Throws "not supported on inngest workflows" |
| `cloneAsSteps`      | Cloned workflows need Mastra registration   |
| `runCount`          | Different loop behavior                     |
| `retryCount`        | Different retry tracking                    |

---

# Part 3: Default Engine Only

Tests that only make sense for the Default Engine.

| Category                    | Count | Examples             |
| --------------------------- | ----- | -------------------- |
| `stream()` API              | 3     | Streaming results    |
| Agent + MockLanguageModelV1 | 8     | Mock LLM testing     |
| TripWire                    | 3     | Tripwire mechanism   |
| startAsync                  | 2     | Async start pattern  |
| v1 model compatibility      | 2     | Legacy model support |
| Auto-commit workflow        | 2     | Auto-commit feature  |

---

## Future Work

### Priority 1: Add Missing Shared Tests

- [ ] perStep mode tests (9 tests)
- [ ] Tracing tests (2 tests)
- [ ] Sleep variant tests (4 tests)

### Priority 2: Align Engine Behavior

- [ ] Add validation to `InngestWorkflow.createRun()`
- [ ] Add `suspended` array to Inngest results
- [ ] Implement foreach index coordination

### Priority 3: Document Engine-Specific Tests

- [ ] Move Inngest-only tests to dedicated file
- [ ] Move Default-only tests to dedicated file

---

## Skip Configuration Reference

Current `skipTests` in `workflow-factory.test.ts`:

```typescript
skipTests: {
  // Timing
  foreachConcurrentTiming: true,
  foreachPartialConcurrencyTiming: true,

  // Validation
  schemaValidationThrows: true,
  executionFlowNotDefined: true,
  executionGraphNotCommitted: true,

  // Status
  abortStatus: true,

  // Resume
  resumeMultiSuspendError: true,
  resumeForeachLoop: true,
  resumeForeachConcurrent: true,
  resumeForeachIndex: true,
  resumeAutoDetect: true,
  resumeBranchingStatus: true,
  resumeNested: true,
  resumeConsecutiveNested: true,
  resumeDountil: true,
  resumeLoopInput: true,
  resumeMapStep: true,

  // Storage
  storageWithNestedWorkflows: true,

  // Race conditions
  foreachSingleConcurrency: true,

  // Unsupported
  cloneAsSteps: true,
  runCount: true,
  retryCount: true,
}
```
