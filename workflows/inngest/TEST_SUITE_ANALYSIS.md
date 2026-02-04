# Workflow Test Suite - Comprehensive Gap Analysis

## Test Suite Overview

| Suite                     | Tests   | Location                                       |
| ------------------------- | ------- | ---------------------------------------------- |
| Default Engine            | 232     | `packages/core/src/workflows/workflow.test.ts` |
| Inngest Engine (original) | 121     | `workflows/inngest/src/index.test.ts`          |
| Evented Engine (original) | ?       | Not found (uses shared suite only)             |
| **Shared Suite**          | **106** | `workflows/_test-utils/src/domains/*.ts`       |

### Shared Suite Usage by Engine

| Engine  | Passed | Skipped | Total | Test File                                        |
| ------- | ------ | ------- | ----- | ------------------------------------------------ |
| Evented | 92     | 10      | 102   | `workflows/_test-utils/src/evented.test.ts`      |
| Inngest | 96     | 6       | 102   | `workflows/inngest/src/workflow-factory.test.ts` |

### Skipped Tests Comparison

| Test                            | Evented | Inngest | Reason                    |
| ------------------------------- | ------- | ------- | ------------------------- |
| restart (domain)                | ❌ Skip | ❌ Skip | Not supported             |
| state                           | ❌ Skip | ✅ Pass | Evented: WIP              |
| errorIdentity                   | ❌ Skip | ✅ Pass | Evented: serialization    |
| schemaValidationThrows          | ❌ Skip | ❌ Skip | Async validation          |
| abortStatus                     | ❌ Skip | ❌ Skip | No 'canceled' status      |
| emptyForeach                    | ❌ Skip | ✅ Pass | Evented: timeout issue    |
| foreachConcurrentTiming         | ✅ Pass | ❌ Skip | Inngest: network overhead |
| foreachPartialConcurrencyTiming | ✅ Pass | ❌ Skip | Inngest: network overhead |
| errorStorageRoundtrip           | ✅ Pass | ❌ Skip | Inngest: factory setup    |

---

## Shared Suite Domain Coverage (106 tests)

| Domain               | Tests | Status                                         |
| -------------------- | ----- | ---------------------------------------------- |
| basic-execution      | 9     | ✅ Both engines                                |
| variable-resolution  | 9     | ✅ Both engines                                |
| branching            | 7     | ✅ Both engines                                |
| callbacks            | 7     | ✅ Both engines                                |
| error-handling       | 8     | ✅ Both engines                                |
| suspend-resume       | 6     | ✅ Both engines                                |
| time-travel          | 6     | ✅ Both engines                                |
| foreach              | 6     | ✅ Both engines                                |
| simple-conditions    | 5     | ✅ Both engines                                |
| schema-validation    | 5     | ⚠️ 2 skipped on Inngest (sync throw)           |
| nested-workflows     | 5     | ✅ Both engines                                |
| per-step             | 5     | ✅ Both engines                                |
| restart              | 4     | ❌ Inngest: not supported                      |
| workflow-runs        | 4     | ✅ Both engines                                |
| abort                | 3     | ⚠️ 1 skipped on Inngest (no 'canceled' status) |
| agent-step           | 3     | ✅ Both engines                                |
| retry                | 3     | ✅ Both engines                                |
| loops                | 2     | ✅ Both engines                                |
| dependency-injection | 2     | ✅ Both engines                                |
| streaming            | 2     | ✅ Both engines                                |
| tracing              | 2     | ✅ Both engines                                |
| complex-conditions   | 1     | ✅ Both engines                                |
| interoperability     | 1     | ✅ Both engines                                |
| multiple-chains      | 1     | ✅ Both engines                                |

---

## Gap Analysis: Default Engine → Shared Suite

**126 tests in Default Engine not in Shared Suite**

### High Priority - Should Add to Shared Suite

#### 1. State Management (6+ tests)

- `should execute a single step workflow successfully with state`
- `should execute a single step nested workflow successfully with state`
- `should execute a single step nested workflow successfully with state being set by the nested workflow`
- `should execute multiple steps in parallel with state`
- `should follow conditional chains with state`
- `should handle basic suspend and resume flow with async await syntax with state`

**Why Missing:** Tests pass on Inngest after race condition fix but weren't added to shared suite.

#### 2. Advanced Suspend/Resume (8+ tests)

- `should handle basic suspend and resume flow using resumeLabel`
- `should handle basic suspend and resume in a dountil workflow`
- `should handle basic suspend and resume in nested dountil workflow - bug #5650`
- `should handle writer.custom during resume operations`
- `should support both explicit step resume and auto-resume (backwards compatibility)`
- `should have access to the correct input value when resuming in a loop`
- `should have access to the correct inputValue when resuming a step preceded by a .map step`
- `should preserve state across suspend and resume cycles`

**Why Missing:** More complex suspend/resume patterns not yet ported.

#### 3. Nested Workflow Advanced (8+ tests)

- `should be able to suspend nested workflow step in a nested workflow step`
- `should be able to resume suspended nested workflow step with only nested workflow step provided`
- `should not execute incorrect branches after resuming from suspended nested workflow`
- `should maintain correct step status after resuming in branching workflows - #6419`
- `should handle consecutive nested workflows with suspend/resume`
- `should preserve request context in nested workflows after suspend/resume`
- `should be able to spec out workflow result via variables`
- `should be able clone workflows as steps`

**Why Missing:** Advanced nested workflow patterns not ported.

#### 4. Foreach Advanced (5+ tests)

- `should suspend and resume when running a single item concurrency (default) for loop`
- `should run a all item concurrency for loop`
- `should suspend and resume when running all items concurrency for loop`
- `should suspend and resume provided index when running all items concurrency for loop`
- `should suspend and resume provided label when running all items concurrency for loop`
- `should run a partial item concurrency for loop`
- `should bail foreach execution when called in a concurrent batch`

**Why Missing:** Foreach with suspend/resume not tested in shared suite.

#### 5. Streaming Tests (8+ tests)

- `should generate a stream`
- `should generate a stream for a single step when perStep is true`
- `should generate a stream for a single step workflow successfully with state`
- `should continue streaming current run on subsequent stream calls`
- `should handle custom event emission using writer`
- `should handle basic suspend and resume flow that does not close on suspend`

**Why Missing:** Streaming API differs between engines.

#### 6. Storage/Persistence (5+ tests)

- `should use shouldPersistSnapshot option`
- `should get and delete workflow run by id from storage`
- `should get workflow runs from storage`
- `should persist resourceId when creating workflow runs`
- `should preserve resourceId when resuming a suspended workflow`

**Why Missing:** Storage API requires mastra instance setup.

#### 7. Error Handling Advanced (5+ tests)

- `should persist error message without stack trace in snapshot`
- `should persist MastraError message without stack trace in snapshot`
- `should load serialized error from storage via getWorkflowRunById`
- `should handle errors from agent.stream() with full error details`
- `should preserve error details in streaming workflow`

**Why Missing:** Error serialization tests not ported.

#### 8. Variable Resolution Advanced (5+ tests)

- `should resolve trigger data from getInitData with workflow schema`
- `should resolve trigger data and DI requestContext values via .map()`
- `should resolve dynamic mappings via .map() with custom step id`
- `should resolve inputs from previous steps that are not objects`

**Why Missing:** More complex mapping patterns not tested.

#### 9. Abort Advanced (3+ tests)

- `should be able to abort workflow execution immediately`
- `should be able to abort workflow execution during a step`
- `should be able to cancel a suspended workflow`

**Why Missing:** Abort behavior differs on Inngest.

#### 10. Parallel Steps (4+ tests)

- `should properly update snapshot when executing multiple steps in parallel`
- `should update state after each concurrent batch in foreach step`
- `should properly update state when executing multiple steps in parallel`
- `should support consecutive parallel calls with proper type inference`

**Why Missing:** Parallel execution state management not tested.

### Medium Priority

#### 11. Run Count Tests (2 tests)

- `runCount should exist and equal zero for the first run`
- `multiple steps should have different run counts`

#### 12. Parallel Suspended Steps (3 tests)

- `should remain suspended when only one of multiple parallel suspended steps is resumed - #6418`
- `should complete parallel workflow when steps do not suspend`
- `should handle multiple suspend/resume cycles in parallel workflow`

#### 13. Agent Advanced (4+ tests)

- `should be able to use an agent in parallel`
- `should be able to use an agent as a step via mastra instance`
- `should be able to use an agent as a step in nested workflow via mastra instance`
- `should pass agentOptions when wrapping agent with createStep`

### Low Priority (Engine-Specific or Edge Cases)

- Auto-commit workflow tests
- v1 model agent tests
- TripWire tests
- startAsync tests

---

## Gap Analysis: Inngest-Specific Tests

**15 tests that are Inngest-only (cannot share)**

### Inngest Infrastructure

- `should accept workflow configuration with flow control properties`
- `should handle workflow configuration with partial flow control properties`
- `should handle workflow configuration without flow control properties (backward compatibility)`
- `should support all flow control configuration types`
- `should execute workflow via cron schedule`
- `should execute workflow via cron schedule with initialState`

### Inngest Serve Function

- `should merge user-supplied functions with workflow functions`
- `should work with empty user functions array`
- `should work when no functions parameter is provided`

### Inngest Step Primitives

- `should inject inngest step primitives into steps during run`

### Inngest Realtime

- Streaming tests using `@inngest/realtime`
- Custom event emission tests

### Inngest Eval Framework

- `should run experiment with workflow target` (x2)

**Recommendation:** Keep these in `index.test.ts` only.

---

## Recommendations

### Phase 1: Quick Wins (Add 20+ tests)

1. **State Management** - Port 6 state-related tests
2. **Variable Resolution** - Add 5 advanced mapping tests
3. **Foreach** - Add suspend/resume during foreach tests

### Phase 2: Suspend/Resume Expansion (Add 15+ tests)

1. **Advanced Suspend/Resume** - Port 8 advanced patterns
2. **Parallel Suspended Steps** - Port 3 tests
3. **Nested Workflow Suspend** - Port 4 tests

### Phase 3: Storage & Persistence (Add 8+ tests)

1. **Storage Domain** - Create new domain with 5+ tests
2. **Error Persistence** - Add to error-handling domain

### Phase 4: Streaming (Add 6+ tests)

1. **Streaming Domain** - Expand with engine-specific implementations
2. May need conditional test logic for engine differences

---

## Inngest-Specific Limitations

### Cannot Fix

1. **Timing tests** - Network overhead inherent to HTTP model
2. **Restart** - Not supported, throws error
3. **Schema validation throws** - Async model can't throw sync

### Could Fix with Engine Changes

1. **Abort 'canceled' status** - Would need Inngest engine changes

### Could Fix with Test Infrastructure

1. **Storage roundtrip** - Need proper mastra setup in factory

---

## Summary

| Category                 | Current Shared | Potential New | Notes                        |
| ------------------------ | -------------- | ------------- | ---------------------------- |
| Shared Suite Total       | 106            | +60-80        |                              |
| State Management         | 0              | +6            | Should add                   |
| Advanced Suspend         | 0              | +8            | Should add                   |
| Nested Workflow Advanced | 0              | +8            | Should add                   |
| Foreach Advanced         | 0              | +7            | Should add                   |
| Streaming                | 2              | +6            | Engine-specific logic needed |
| Storage                  | 0              | +5            | New domain needed            |
| Inngest-specific         | N/A            | 15            | Keep separate                |

**Projected Shared Suite:** 160-180 tests (up from 106)

---

## Key Insight: Default Engine Doesn't Use Shared Suite

The Default Engine (`packages/core`) has its own standalone 232-test suite in `workflow.test.ts`.
It does **not** use the shared test factory.

### Recommendation: Add Default Engine to Shared Suite

Create `packages/core/src/workflows/workflow-factory.test.ts` that uses `createWorkflowTestSuite()`.

**Benefits:**

- Validate shared suite works with default engine
- Ensure test parity across all engines
- Single source of truth for workflow behavior
- Easier to add new tests (add once, run everywhere)

**Implementation:**

```typescript
import { createWorkflowTestSuite } from '@internal/workflow-test-utils';
import { createWorkflow, createStep } from '@mastra/core/workflows';

createWorkflowTestSuite({
  name: 'Workflow (Default Engine)',
  getWorkflowFactory: () => ({ createWorkflow, createStep }),
  executeWorkflow: async (workflow, inputData, options) => {
    const run = await workflow.createRun({ runId: options?.runId });
    return run.start({ inputData, initialState: options?.initialState });
  },
  // Default engine supports all features
  skip: {},
  skipTests: {},
});
```

This would immediately validate that all 106 shared tests pass on the default engine.
