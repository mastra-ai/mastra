# Roadmap: Evented Workflow Runtime Parity

**Created:** 2026-01-26
**Depth:** Comprehensive
**Phases:** 6
**Test Gap:** 119 tests in default not in evented (119 tests already pass)

## Overview

The evented workflow runtime already implements most features (119/125 tests passing). This roadmap closes the remaining gaps to achieve full test parity with the default runtime. Each phase ports missing tests from default to evented and fixes any failures.

**Current State:**

- Evented tests: 119 passing, 6 skipped
- Default tests: 232 total
- Gap: 119 tests exist in default but not evented

## Phases

### Phase 1: State Object Support

**Goal:** Implement the `state` parameter that allows workflows to maintain mutable state across steps

**Gap Analysis:** 12 tests reference `state` parameter not available in evented runtime

**Plans:** 2 plans

Plans:

- [x] 01-01-PLAN.md - Port 12 state-related tests from default to evented runtime (RED phase)
- [x] 01-02-PLAN.md - Implement state support to make tests pass (GREEN phase)

**Missing Tests:**

- should execute a single step workflow successfully with state
- should execute multiple steps in parallel with state
- should follow conditional chains with state
- should preserve state across suspend and resume cycles
- should properly update state when executing multiple steps in parallel
- should provide state in onError callback
- should provide state in onFinish callback
- should update state after each concurrent batch in foreach step
- should generate a stream for a single step workflow successfully with state
- should handle basic suspend and resume flow with async await syntax with state
- should execute a single step nested workflow successfully with state
- should execute a single step nested workflow successfully with state being set by the nested workflow

**Success Criteria:**

1. Port all 12 state-related tests from default to evented
2. All 12 tests pass
3. State object persists correctly across event boundaries

---

### Phase 2: Lifecycle Callbacks (onFinish/onError)

**Goal:** Port 15 callback context tests and fix resourceId propagation

**Gap Analysis:** 15 tests verify callback context properties (state callbacks already covered in Phase 1)

**Plans:** 1 plan

Plans:

- [x] 02-01-PLAN.md - Port 15 callback context tests and fix resourceId bug

**Missing Tests:**

- should provide mastra instance in onFinish callback
- should provide mastra instance in onError callback
- should provide logger in onFinish callback
- should provide logger in onError callback
- should provide runId in onFinish callback
- should provide runId in onError callback
- should provide workflowId in onFinish callback
- should provide workflowId in onError callback
- should provide resourceId in onFinish callback when provided
- should provide resourceId in onError callback when provided
- should provide requestContext in onFinish callback
- should provide requestContext in onError callback
- should provide getInitData function in onFinish callback
- should provide getInitData function in onError callback
- should support async onError callback

**Success Criteria:**

1. Port all 15 callback context tests
2. All callbacks fire with correct context
3. Async callbacks are properly awaited
4. resourceId correctly propagated to callbacks

---

### Phase 3: Schema Validation & Defaults

**Goal:** Full schema validation including default values from schemas

**Gap Analysis:** ~12 tests for schema defaults and validation edge cases

**Plans:** 1 plan

Plans:

- [x] 03-01-PLAN.md - Port 12 schema validation tests and fix any validation gaps

**Missing Tests:**

- should use default value from inputSchema
- should use default value from inputSchema for step input
- should use default value from resumeSchema when resuming a workflow
- should throw error if inputData is invalid
- should throw error if inputData is invalid in nested workflows
- should throw error if inputData is invalid in workflow with .map()
- should throw error if trigger data is invalid
- should throw error when you try to resume a workflow step with invalid resume data
- should preserve ZodError as cause when input validation fails
- should properly validate input schema when .map is used after .foreach
- should allow a steps input schema to be a subset of the previous step output schema

**Success Criteria:**

1. Port all schema validation tests
2. Default values from schemas are applied
3. Validation errors preserve ZodError details

---

### Phase 4: Suspend/Resume Edge Cases

**Goal:** Handle all suspend/resume scenarios including parallel, labels, and nested edge cases

**Gap Analysis:** 26 tests for suspend/resume edge cases not covered

**Plans:** 6 plans

Plans:

- [x] 04-01-PLAN.md - Auto-resume and error handling (5 passing, 1 skipped)
- [x] 04-02-PLAN.md - Resume labels and suspendData (3 passing, 1 skipped)
- [x] 04-03-PLAN.md - Parallel/branch suspend (0 passing, 4 skipped)
- [x] 04-04-PLAN.md - Context preservation (2 passing)
- [x] 04-05-PLAN.md - Nested workflow edge cases (1 passing, 3 skipped)
- [x] 04-06-PLAN.md - Foreach suspend/resume (0 passing, 6 skipped)

**Missing Tests:**

Auto-resume & Error Handling:
- should auto-resume simple suspended step without specifying step parameter
- should throw error when multiple steps are suspended and no step specified
- should throw error when you try to resume a workflow that is not suspended
- should throw error when you try to resume a workflow step that is not suspended
- should support both explicit step resume and auto-resume (backwards compatibility)
- should handle missing suspendData gracefully

Resume Labels & SuspendData:
- should handle basic suspend and resume flow using resumeLabel
- should provide access to suspendData in workflow step on resume
- should handle basic suspend and resume flow that does not close on suspend
- should preserve input property from snapshot context after resume

Parallel/Branch:
- should remain suspended when only one of multiple parallel suspended steps is resumed
- should handle multiple suspend/resume cycles in parallel workflow
- should maintain correct step status after resuming in branching workflows
- should not execute incorrect branches after resuming from suspended nested workflow

Context Preservation:
- should preserve request context in nested workflows after suspend/resume
- should have access to requestContext from before suspension during workflow resume

Nested Workflow Edge Cases:
- should handle consecutive nested workflows with suspend/resume
- should be able to resume suspended nested workflow step with only nested workflow step provided
- should have access to the correct input value when resuming in a loop
- should handle basic suspend and resume in nested dountil workflow

Foreach Suspend/Resume:
- should suspend and resume when running a single item concurrency (default) for loop
- should suspend and resume when running all items concurrency for loop
- should suspend and resume provided index when running all items concurrency for loop
- should suspend and resume provided label when running all items concurrency for loop
- should suspend and resume when running a partial item concurrency for loop
- should suspend and resume provided index when running a partial item concurrency for loop

**Success Criteria:**

1. Port all 26 suspend/resume edge case tests
2. Parallel suspend scenarios work correctly
3. Resume labels function properly
4. Nested workflow suspend/resume propagates correctly
5. Foreach suspend/resume works at iteration level

---

### Phase 5: Streaming vNext

**Goal:** Implement modern streaming API (currently skipped)

**Gap Analysis:** 6 tests in "Streaming (vNext)" describe block skipped

**Missing Tests:**

- should continue streaming current run on subsequent stream calls
- should preserve error details in streaming workflow
- should handle errors from agent.stream() with full error details
- should return tripwire status when streaming agent in workflow
- should handle tripwire from output stream processor in agent within workflow

**Note:** Evented has "Streaming Legacy" working, need vNext API

**Success Criteria:**

1. Unskip the Streaming describe block
2. Implement vNext streaming API
3. All streaming tests pass

---

### Phase 6: Remaining Parity

**Goal:** Close all remaining test gaps for full parity

**Gap Analysis:** Miscellaneous tests not covered in prior phases

**Missing Tests:**

- Writer functionality (2 tests)
- Sleep with fn parameter (2 tests)
- Run count/status tests
- Storage operations (get/delete workflow run)
- Snapshot persistence options
- Agent step options
- Nested workflow result information
- Automatic workflow commit
- Foreach bail functionality
- Tracing context TypeScript support
- resourceId preservation

**Success Criteria:**

1. Port all remaining tests
2. Full test parity achieved
3. No skipped tests remain (except intentionally unsupported features)

---

## Out of Scope

### Restart Functionality

**Explicitly unsupported** - The evented runtime throws an error when `restart()` is called:

> "restart() is not supported on evented workflows"

6 restart-related tests will not be ported. This is a design decision, not a gap.

---

## Progress

| Phase | Name                      | Tests to Port | Status      |
| ----- | ------------------------- | ------------- | ----------- |
| 1     | State Object Support      | 12            | Complete    |
| 2     | Lifecycle Callbacks       | 15            | Complete    |
| 3     | Schema Validation         | 12 (9+3skip)  | Complete    |
| 4     | Suspend/Resume Edge Cases | 26 (11+15skip)| Complete    |
| 5     | Streaming vNext           | 6             | Not Started |
| 6     | Remaining Parity          | ~43           | Not Started |

**Total:** ~49 tests to port (~113 - 47 completed - 17 skipped)

---

_Roadmap created: 2026-01-26_
_Last updated: 2026-01-27 after Phase 4 completion_
