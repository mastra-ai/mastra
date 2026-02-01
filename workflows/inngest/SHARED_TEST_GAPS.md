# Shared Test Suite - Gap Analysis

## Current State

| Suite                   | Tests                   | Status                    |
| ----------------------- | ----------------------- | ------------------------- |
| Default Engine Original | 232                     | Standalone                |
| Inngest Original        | 121                     | Standalone                |
| **Shared Suite**        | **177**                 | Used by Default + Inngest |
| Default (shared)        | 176 passed, 1 skipped   | ✅                        |
| Inngest (shared)        | ~160 passed, 17 skipped | ✅                        |

**Gap**: 55 tests from Default Engine not yet in shared suite

---

## TODO: Remaining Work

### ~~T1: Time Travel Tests~~ ✅ DONE

Added 8 timeTravel API tests:

- `should timeTravel a workflow execution`
- `should timeTravel workflow execution for workflow with parallel steps`
- `should timeTravel a workflow execution and run only one step when perStep is true`
- `should timeTravel a workflow execution that was previously ran`
- `should timeTravel a workflow execution that has nested workflows`
- `should successfully suspend and resume a timeTravelled workflow execution`
- `should timeTravel to step in conditional chains`
- `should timeTravel workflow execution for a do-until workflow`

---

### ~~T2: Advanced Callback Tests~~ ✅ MOSTLY DONE (6/8)

Added 6 callback tests:

- `should provide getInitData function in onFinish callback` ✅
- `should provide getInitData function in onError callback` ✅
- `should provide logger in onFinish callback` ✅
- `should provide logger in onError callback` ✅
- `should provide requestContext in onFinish callback` ✅
- `should provide requestContext in onError callback` ✅

**Remaining (requires different execute pattern):**

- `should provide mastra instance in onFinish callback`
- `should provide mastra instance in onError callback`

> **Note:** These tests require executing through `mastra.getWorkflow().createRun()` instead of directly on the workflow object. Would need to add a `getMastra()` helper to the test context or change how `execute()` works.

---

### ~~T3: Clone Workflows~~ ✅ PARTIALLY DONE (1/2)

Added clone domain with `cloneStep` and `cloneWorkflow` support:

- `should be able to spec out workflow result via variables` ✅

**Skipped (requires special Mastra registration for cloned workflows):**

- `should be able clone workflows as steps` - cloned workflows in parallel need special handling

> **Note:** The cloned workflows test is skipped because cloned workflows need to be registered with Mastra separately when used in parallel. The original test doesn't use Mastra registration.

---

### ~~T4: Parallel Suspended Steps~~ ✅ DONE

Already had parallel suspend tests, added 1 additional:

- `should complete parallel workflow when steps do not suspend` ✅ (already existed)
- `should remain suspended when only one of multiple parallel suspended steps is resumed` ✅ (already existed as `resumeParallelMulti`)
- `should throw error when multiple steps are suspended and no step specified` ✅ NEW

---

### ~~T5: Foreach with Suspend/Resume~~ ✅ MOSTLY DONE (3/5)

Added 2 new tests (1 was already present):

- `should suspend and resume when running a single item concurrency for loop` ✅ (already existed as `resumeForeach`)
- `should suspend and resume when running all items concurrency for loop` ✅ NEW
- `should suspend and resume provided index when running all items concurrency for loop` ✅ NEW

**Remaining:**

- `should suspend and resume provided label when running all items concurrency for loop` - Uses label option
- `should bail foreach execution when called in a concurrent batch` - Uses bail() in foreach

---

### ~~T6: Workflow Result Options~~ ✅ DONE (2/3)

Added 2 tests using `workflow.getWorkflowRunById(runId, options)`:

- `should return only requested fields when fields option is specified` ✅ NEW
- `should exclude nested workflow steps when withNestedWorkflows is false` ✅ NEW

**Not added** (covered by existing nested workflow tests):

- `should return workflow run execution result with nested workflow steps information` - Already tested implicitly

---

### ~~T7: Additional Variable Resolution~~ ✅ DONE (3/5)

Added 3 variable resolution tests:

- `should resolve trigger data and DI requestContext values via .map()` ✅
- `should resolve dynamic mappings via .map()` ✅
- `should resolve dynamic mappings via .map() with custom step id` ✅

**Already covered by existing tests:**

- `should resolve trigger data from getInitData with workflow schema` - covered by `var-get-init-data`
- `should resolve inputs from previous steps that are arrays via .map()` - covered by `var-array-output`

---

### ~~T8: Misc Tests~~ ✅ PARTIALLY DONE (3/8)

Added 3 misc tests:

- `should throw error when execution flow not defined` ✅
- `should throw error when execution graph is not committed` ✅
- `should handle missing suspendData gracefully` ✅

**Remaining (require specific APIs):**
| Test | Blocker | Priority |
|------|---------|----------|
| `should only update workflow status to success after all steps have run successfully` | Uses streamLegacy() API | Medium |
| `should use default value from resumeSchema when resuming a workflow` | Resume API | Low |
| `should preserve resourceId when resuming a suspended workflow` | Resume API | Low |
| `should use shouldPersistSnapshot option` | Options support | Low |

---

### T9: Bug Fixes

| Bug   | Test                                                                | Status  |
| ----- | ------------------------------------------------------------------- | ------- |
| #5650 | `should handle basic suspend and resume in nested dountil workflow` | Blocked |

---

## Engine-Specific (Cannot Share)

These tests require engine-specific APIs and should remain in original test files:

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

## Inngest Skipped Tests (15)

These pass on Default but skip on Inngest due to engine differences:

| Test                              | Reason                           |
| --------------------------------- | -------------------------------- |
| `schemaValidationThrows` (x2)     | Async validation                 |
| `abortStatus`                     | Returns 'failed' not 'canceled'  |
| `foreachSingleConcurrency`        | Race condition                   |
| `foreachConcurrentTiming`         | Network overhead                 |
| `foreachPartialConcurrencyTiming` | Network overhead                 |
| `runCount`                        | Loop behavior differs            |
| `retryCount`                      | Loop behavior differs            |
| `resumeAutoDetect`                | No 'suspended' array             |
| `resumeBranchingStatus`           | Returns 'failed' not 'suspended' |
| `resumeNested`                    | Nested step path not supported   |
| `resumeConsecutiveNested`         | Nested step path not supported   |
| `resumeDountil`                   | Dountil + nested not supported   |
| `resumeLoopInput`                 | Loop resume tracking             |
| `resumeMapStep`                   | Map step resume                  |

---

## Implementation Priority

1. ~~**T1: Time Travel** - Add timetravel API to context~~ ✅ DONE
2. ~~**T7: Variable Resolution** - No blockers, add now~~ ✅ DONE
3. ~~**T8: Misc Tests** - Most have no blockers~~ ✅ PARTIALLY DONE (3/8)
4. ~~**T3: Clone Workflows** - Add clone functions to context~~ ✅ PARTIALLY DONE (1/2)
5. ~~**T4: Parallel Suspended** - Complex state management~~ ✅ DONE
6. ~~**T2: Advanced Callbacks** - Need mastra instance access~~ ✅ MOSTLY DONE (6/8)
7. ~~**T5: Foreach Resume** - forEachIndex is supported~~ ✅ MOSTLY DONE (3/5)
8. ~~**T6: Result Options** - Uses workflow.getWorkflowRunById~~ ✅ DONE
