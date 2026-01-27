---
phase: 03-schema-validation
plan: 01
subsystem: testing
tags: [zod, schema, validation, defaults, testing]

# Dependency graph
requires:
  - phase: 02-lifecycle-callbacks
    provides: Lifecycle callback context functionality
provides:
  - 12 schema validation tests ported to evented runtime
  - Test coverage for default values, validation errors, ZodError preservation
  - Test coverage for complex scenarios (.map after .foreach, subset schemas)
affects: [03-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [Test patterns for evented workflow validation]

key-files:
  created: []
  modified:
    - packages/core/src/workflows/evented/evented-workflow.test.ts

key-decisions:
  - "Each test creates its own Mastra instance with registered workflows"
  - "Complex subset schema test registers all 4 workflows in single Mastra instance"

patterns-established:
  - "Pattern 1: Evented tests require new Mastra({workflows, pubsub, storage}) with startEventEngine/stopEventEngine lifecycle"
  - "Pattern 2: Multiple workflows in single test can share one Mastra instance if all registered upfront"

# Metrics
duration: 27min
completed: 2026-01-27
---

# Phase 03 Plan 01: Schema Validation Tests Ported

**12 comprehensive schema validation tests ported from default runtime with evented-specific adaptations (Mastra instances, event engine lifecycle)**

## Performance

- **Duration:** 27 min
- **Started:** 2026-01-27T05:38:49Z
- **Completed:** 2026-01-27T06:05:17Z
- **Tasks:** 1 of 3 (Task 1 complete, Task 2 in progress)
- **Files modified:** 1

## Accomplishments
- Replaced single skipped test with 12 comprehensive schema validation tests
- All tests adapted for evented runtime (Mastra instances, pubsub, event engine lifecycle)
- Tests cover default values (inputSchema, step inputSchema, resumeSchema)
- Tests cover validation errors with proper error messages and ZodError preservation
- Tests cover complex scenarios: .map after .foreach, subset schemas, nested workflows

## Task Commits

Each task was committed atomically:

1. **Task 1: Port 12 schema validation tests** - `eb385a80d7` (test)

**Status:** Task 1 complete. Task 2 (fix failures) in progress - tests running to identify issues.

## Files Created/Modified
- `packages/core/src/workflows/evented/evented-workflow.test.ts` - Added 12 schema validation tests in "Schema Validation" describe block

## Test Categories Ported

### Default Values (3 tests)
1. **should use default value from inputSchema** - Workflow input with `.optional().default({ value: 1 })`
2. **should use default value from inputSchema for step input** - Step2 has `.optional().default('test')`, uses `.map()` to pass undefined
3. **should use default value from resumeSchema when resuming a workflow** - Resume with `{}`, verify default 21 is applied

### Validation Errors (5 tests)
4. **should throw error if trigger data is invalid** - Pass nested.value as string instead of number
5. **should throw error if inputData is invalid** - Step2 expects `{ start: string }` but receives `{ result: string }` from step1
6. **should throw error if inputData is invalid in workflow with .map()** - Step2 expects string, gets number after `.map()`
7. **should throw error if inputData is invalid in nested workflows** - Nested workflow step validation fails, error propagates
8. **should throw error when you try to resume a workflow step with invalid resume data** - Resume with `{ number: 2 }` instead of `{ value: number }`

### Error Details (1 test)
9. **should preserve ZodError as cause when input validation fails** - Verify `result.error.cause.issues` is array with >= 2 items

### Complex Scenarios (3 tests)
10. **should properly validate input schema when .map is used after .foreach** - Bug #11313 regression test, foreach + map chain
11. **should allow a steps input schema to be a subset of the previous step output schema** - Test equal, missing required, missing optional, extra optional key scenarios (4 workflows in 1 test)
12. **should throw error if inputData is invalid after foreach** - Validation after foreach with wrong key

### Additional Test
13. **should validate nested workflow input correctly** - Nested workflow input type mismatch

## Evented Runtime Adaptations

All tests required these adaptations:
- Created `Mastra` instance with `workflows`, `storage: testStorage`, `pubsub: new EventEmitterPubSub()`
- Called `await mastra.startEventEngine()` before test execution
- Called `await mastra.stopEventEngine()` after test completion
- Used workflow IDs with `-evented` suffix to avoid conflicts with default runtime
- Registered workflows with Mastra before calling `createRun()`

Special case (test 11 - subset schemas):
- Test creates 4 workflows (workflow, missingRequiredKeyWorkflow, missingOptionalKeyWorkflow, extraOptionalKeyWorkflow)
- All 4 workflows registered in single Mastra instance at test start
- All workflow definitions hoisted to beginning before commits
- Single `startEventEngine/stopEventEngine` pair for all 4 workflow runs

## Decisions Made

**1. Each test creates own Mastra instance**
- Rationale: Isolation between tests, matches existing test patterns in file
- Alternative considered: Shared Mastra in beforeEach/afterEach - rejected due to workflow registration complexity

**2. Complex subset schema test uses single Mastra for 4 workflows**
- Rationale: Test runs 4 workflows sequentially, all can share one Mastra instance
- Hoisted all workflow definitions and commits before Mastra creation for clarity

## Deviations from Plan

**1. [Rule 3 - Blocking] Fixed duplicate mastra declarations**
- **Found during:** Testing after initial port
- **Issue:** Script-based additions created duplicate `const mastra` declarations in lines outside Schema Validation tests (6816, 6890, 6966, 10791)
- **Fix:** Removed 4 sets of duplicate declarations (7 lines each) using sed
- **Files modified:** packages/core/src/workflows/evented/evented-workflow.test.ts
- **Verification:** File now type-checks without errors
- **Committed in:** eb385a80d7 (Task 1 commit includes cleanup)

**2. [Rule 3 - Blocking] Fixed subset schema test structure**
- **Found during:** Test porting
- **Issue:** Original test creates 4 workflows inline; needed proper Mastra registration
- **Fix:** Hoisted all workflow definitions, registered all 4 in single Mastra instance
- **Files modified:** packages/core/src/workflows/evented/evented-workflow.test.ts
- **Verification:** Test structure matches evented runtime requirements
- **Committed in:** eb385a80d7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both auto-fixes necessary for tests to compile and run. No scope creep.

## Issues Encountered

**1. Python script over-insertion**
- Problem: Automated script for adding Mastra instances also modified tests outside Schema Validation block
- Resolution: Manually removed duplicate declarations using targeted sed commands

**2. Complex test structure (subset schemas)**
- Problem: Test creates 4 workflows sequentially, unclear how to register all with Mastra
- Resolution: Hoisted all definitions and registered all 4 workflows in single Mastra instance at test start

## Next Phase Readiness

**Task 1 Status:** ✅ Complete
- 12 tests ported to evented-workflow.test.ts
- All tests adapted for evented runtime patterns
- Tests type-check successfully

**Task 2 Status:** ⏳ In Progress
- Tests are currently running to identify failures
- May need fixes in utils.ts validateStepInput (isEmpty check preventing defaults)
- Expected fix: Change `inputData = isEmptyData ? prevOutput : validatedInput.data;` to `inputData = validatedInput.data;`

**Task 3 Status:** ⏳ Pending
- Awaits Task 2 completion
- Final verification and commit

**Current Test Count:** 146 existing + 12 new = 158 expected (pending verification)

**Blockers:** None - Task 2 can proceed once test results are available

---
*Phase: 03-schema-validation*
*Completed: 2026-01-27*
