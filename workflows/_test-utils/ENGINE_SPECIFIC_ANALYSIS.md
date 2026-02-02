# workflow.test.ts - Detailed Analysis

**File:** `packages/core/src/workflows/workflow.test.ts`
**Total Tests:** 155

---

## SUMMARY BY CATEGORY

| Category | Count | Likely Duplicates | Engine-Specific |
|----------|-------|-------------------|-----------------|
| Streaming | 20 | ~10 (50%) | ~10 (50%) |
| Basic Execution | 30 | ~12 (40%) | ~18 (60%) |
| Foreach/Loop | 8 | ~2 (25%) | ~6 (75%) |
| Schema Validation | 10 | ~5 (50%) | ~5 (50%) |
| Suspend/Resume | 16 | ~5 (30%) | ~11 (70%) |
| Restart | 5 | 0 (0%) | 5 (100%) |
| Time Travel | 13 | 0 (0%) | 13 (100%) |
| Agent as Step | 4 | ~2 (50%) | ~2 (50%) |
| Nested Workflows | 17 | ~5 (30%) | ~12 (70%) |
| Dependency Injection | 4 | ~1 (25%) | ~3 (75%) |
| Additional Features | 15 | 0 (0%) | 15 (100%) |
| **TOTAL** | **155** | **~42 (27%)** | **~100 (65%)** |

---

## STREAMING TESTS (20 tests)

### Legacy API (8 tests, Lines 37-1288):

1. **should generate a stream**
   - Tests: Basic stream generation
   - Setup: step1 → step2 sequential
   - LIKELY DUPLICATE: Yes - shared suite has "should execute workflow that could be streamed"

2. **should handle basic suspend and resume flow using resumeLabel**
   - Tests: Resume via resumeLabel in streaming context
   - Features: resumeLabel option
   - ENGINE-SPECIFIC: resumeLabel is engine-specific feature

3. **should continue streaming current run on subsequent stream calls**
   - Tests: Multiple stream() calls on same run
   - ENGINE-SPECIFIC: Stream continuation behavior

4. **should be able to use an agent as a step** (x2 - appears twice)
   - Tests: Agent integration in streaming
   - LIKELY DUPLICATE: Yes - shared suite has agent-step tests

5. **should pass agentOptions when wrapping agent with createStep**
   - Tests: Agent options passthrough
   - LIKELY DUPLICATE: Partial - shared suite tests agent options

6. **should handle sleep waiting flow** (x2)
   - Tests: Sleep in streaming context
   - Setup: step1 → sleep(1000) → step2
   - LIKELY DUPLICATE: Yes - shared suite has "should execute a sleep step"

7. **should handle sleep waiting flow with fn parameter** (x2)
   - Tests: Dynamic sleep duration
   - LIKELY DUPLICATE: Yes - shared suite has "should execute a sleep step with fn parameter"

### vNext API (12 tests, Lines 1289-2979):

8. **should preserve input property from snapshot context after resume**
   - Tests: Input preservation through resume
   - ENGINE-SPECIFIC: Snapshot context handling

9. **should generate a stream for a single step when perStep is true**
   - Tests: perStep with streaming
   - LIKELY DUPLICATE: Partial - perStep is in shared suite

10. **should generate a stream for a single step workflow successfully with state**
    - Tests: State + streaming
    - LIKELY DUPLICATE: Yes - shared suite has streaming with state

11. **should handle basic suspend and resume flow that does not close on suspend**
    - Tests: Stream stays open on suspend
    - ENGINE-SPECIFIC: Stream behavior on suspend

12. **should handle custom event emission using writer**
    - Tests: writer.custom() for custom events
    - ENGINE-SPECIFIC: Writer API

13. **should handle errors from agent.stream() with full error details**
    - Tests: Agent streaming error handling
    - ENGINE-SPECIFIC: Agent streaming errors

14. **should handle tripwire from output stream processor in agent within workflow**
    - Tests: Tripwire mechanism
    - ENGINE-SPECIFIC: Tripwire is engine-specific safety feature

---

## BASIC EXECUTION (30 tests, Lines 2980-4576)

1. **should automatically commit uncommitted workflow when registering in mastra instance**
   - ENGINE-SPECIFIC: Mastra registration behavior

2. **should execute a single step nested workflow successfully with state**
   - LIKELY DUPLICATE: Yes - shared suite has nested with state

3. **should execute a single step nested workflow successfully with state being set by the nested workflow**
   - LIKELY DUPLICATE: Yes - shared suite has this

4. **should execute a single step in a nested workflow when perStep is true**
   - LIKELY DUPLICATE: Yes - shared suite has perStep with nested

5. **should execute only one step when there are multiple steps in parallel and perStep is true**
   - LIKELY DUPLICATE: Yes - shared suite has this

6. **should follow conditional chains and run only one step when perStep is true**
   - LIKELY DUPLICATE: Partial

7. **should be able to spec out workflow result via variables**
   - ENGINE-SPECIFIC: Variable spec feature

8. **should handle sleep waiting flow** (duplicate within file)
   - INTERNAL DUPLICATE

9. **should execute a a sleep step** (typo in name)
   - LIKELY DUPLICATE: Yes - shared suite has "should execute a sleep step"

10. **should execute a a sleep until step** (typo in name)
    - LIKELY DUPLICATE: Yes - shared suite has "should execute a sleepUntil step"

11. **should execute a sleep until step with fn parameter**
    - LIKELY DUPLICATE: Yes - shared suite has this

12. **should properly update snapshot when executing multiple steps in parallel**
    - ENGINE-SPECIFIC: Snapshot update behavior

13. **should properly update state when executing multiple steps in parallel**
    - LIKELY DUPLICATE: Partial - parallel with state

14. **should complete parallel workflow when steps do not suspend**
    - LIKELY DUPLICATE: Yes - shared suite has "should complete parallel workflow when no steps suspend"

15. **should bail foreach execution when called in a concurrent batch**
    - ENGINE-SPECIFIC: Bail behavior in foreach

16. **should only update workflow status to success after all steps have run successfully**
    - ENGINE-SPECIFIC: Status timing behavior

17. **should update state after each concurrent batch in foreach step**
    - ENGINE-SPECIFIC: Foreach state batching

18-30. Various execution tests...

---

## FOREACH/LOOP TESTS (8 tests, Lines 5235-5968)

1. **should run a all item concurrency for loop** (typo: "a all")
   - LIKELY DUPLICATE: Yes - shared suite has concurrent foreach

2. **should run a partial item concurrency for loop**
   - LIKELY DUPLICATE: Yes - shared suite has partial concurrency

3. **should suspend and resume when running a single item concurrency (default) for loop**
   - LIKELY DUPLICATE: Partial - shared suite has foreach suspend

4. **should suspend and resume when running all items concurrency for loop**
   - ENGINE-SPECIFIC: Concurrent foreach suspend variations

5. **should suspend and resume provided index when running all items concurrency for loop**
   - ENGINE-SPECIFIC: forEachIndex parameter

6. **should suspend and resume provided index when running a partial item concurrency for loop**
   - ENGINE-SPECIFIC: forEachIndex with partial concurrency

7. **should suspend and resume provided label when running all items concurrency for loop**
   - ENGINE-SPECIFIC: Label-based resume in foreach

8. **should have access to the correct input value when resuming in a loop. bug #6669**
   - BUG FIX: Keep as regression test

---

## SCHEMA VALIDATION (10 tests, Lines 5968-6911)

1. **should preserve ZodError as cause when input validation fails**
   - LIKELY DUPLICATE: Partial - error handling

2. **should throw error if inputData is invalid in workflow with .map()**
   - ENGINE-SPECIFIC: .map() validation

3. **should properly validate input schema when .map is used after .foreach. bug #11313**
   - BUG FIX: Keep as regression test

4. **should throw error when you try to resume a workflow step with invalid resume data**
   - LIKELY DUPLICATE: Yes - resume validation

5. **should use default value from resumeSchema when resuming a workflow**
   - ENGINE-SPECIFIC: resumeSchema defaults

6-10. **Zod v4 duplicates of above tests**
   - INTERNAL DUPLICATES: Same tests repeated for Zod v4

---

## SUSPEND AND RESUME (16 tests, Lines 6911-8767)

1. **should handle basic suspend and resume flow with async await syntax**
   - ENGINE-SPECIFIC: Async/await syntax variation

2. **should handle basic suspend and resume flow with async await syntax with state**
   - ENGINE-SPECIFIC: Async/await with state

3. **should handle basic suspend and resume single step flow with async await syntax and perStep:true**
   - ENGINE-SPECIFIC: perStep + async/await

4. **should inject requestContext dependencies into steps during run**
   - ENGINE-SPECIFIC: RequestContext DI

5. **should inject requestContext dependencies into steps during resume**
   - ENGINE-SPECIFIC: RequestContext through resume

6. **should handle basic suspend and resume in a dountil workflow**
   - LIKELY DUPLICATE: Yes - shared suite has this

7. **should handle writer.custom during resume operations**
   - ENGINE-SPECIFIC: Writer API during resume

8. **should handle basic suspend and resume in nested dountil workflow - bug #5650**
   - BUG FIX: Keep as regression test

9. **should throw error when you try to resume a workflow step that is not suspended**
   - LIKELY DUPLICATE: Partial - error handling

10. **should throw error when you try to resume a workflow that is not suspended**
    - LIKELY DUPLICATE: Partial - error handling

11. **should support both explicit step resume and auto-resume (backwards compatibility)**
    - LIKELY DUPLICATE: Yes - shared suite has this

12. **should have access to the correct inputValue when resuming a step preceded by a .map step**
    - LIKELY DUPLICATE: Yes - shared suite has this

13. **should preserve state across suspend and resume cycles**
    - LIKELY DUPLICATE: Yes - shared suite has this

14. **should auto-resume simple suspended step without specifying step parameter**
    - LIKELY DUPLICATE: Yes - auto-resume

15. **should have access to requestContext from before suspension during workflow resume**
    - ENGINE-SPECIFIC: RequestContext snapshot

16. **should not show removed requestContext values in subsequent steps**
    - ENGINE-SPECIFIC: RequestContext removal tracking

---

## RESTART TESTS (5 tests, Lines 8767-9927)

ALL ENGINE-SPECIFIC - Restart is not in shared suite

1. **should throw error if trying to restart a workflow execution that was not previously active**
2. **should restart a workflow execution that was previously active**
3. **should restart a workflow execution that was previously active and has nested workflows**
4. **should successfully suspend and resume a restarted workflow execution**
5. **should restart workflow execution for a do-while workflow**
6. **should restart workflow execution for workflow with parallel steps**

---

## TIME TRAVEL TESTS (13 tests, Lines 9927-12226)

ALL ENGINE-SPECIFIC - TimeTravel validation not in shared suite

1. **should throw error if trying to timetravel a workflow execution that is still running**
2. **should throw error if validateInputs is true and trying to timetravel a workflow execution with invalid inputData**
3. **should throw error if trying to timetravel to a non-existent step**
4. **should timeTravel a workflow execution and run only one step when perStep is true**
5. **should timeTravel a workflow execution that was previously ran**
6. **should timeTravel a workflow execution that was previously ran and run only one step when perStep is true**
7. **should timeTravel a workflow execution that has nested workflows**
8. **should successfully suspend and resume a timeTravelled workflow execution**
9. **should timetravel a suspended workflow execution**
10. **should timeTravel workflow execution for a do-until workflow**
11. **should timeTravel workflow execution for workflow with parallel steps**
12. **should timeTravel workflow execution for workflow with parallel steps and run just the timeTravelled step when perStep is true**
13. **should timeTravel to step in conditional chains**
14. **should timeTravel to step in conditional chains and run just one step when perStep is true**

---

## AGENT AS STEP (4 tests, Lines 12519-13062)

1. **should be able to use an agent as a step**
   - LIKELY DUPLICATE: Yes - shared suite has agent-step

2. **should be able to use an agent in parallel**
   - ENGINE-SPECIFIC: Parallel agents

3. **should be able to use an agent as a step via mastra instance**
   - ENGINE-SPECIFIC: Mastra registration

4. **should be able to use an agent as a step in nested workflow via mastra instance**
   - ENGINE-SPECIFIC: Nested + Mastra registration

---

## NESTED WORKFLOWS (17 tests, Lines 13062-14965)

1. **should be able to nest workflows**
   - LIKELY DUPLICATE: Yes - shared suite has basic nesting

2. **should be able clone workflows as steps**
   - ENGINE-SPECIFIC: Cloning feature

3. **should be able to nest workflows with conditions**
   - LIKELY DUPLICATE: Yes - shared suite has this

4. **should execute if-branch** / **should execute else-branch** / **should execute nested else and if-branch**
   - ENGINE-SPECIFIC: New if-else branching API

5. **should be able to suspend nested workflow step**
   - LIKELY DUPLICATE: Partial

6. **should be able to resume suspended nested workflow step with only nested workflow step provided**
   - ENGINE-SPECIFIC: Minimal resume params

7. **should handle consecutive nested workflows with suspend/resume**
   - LIKELY DUPLICATE: Yes - shared suite has this

8. **should preserve request context in nested workflows after suspend/resume**
   - ENGINE-SPECIFIC: RequestContext in nested

9. **should be able to suspend nested workflow step in a nested workflow step**
   - ENGINE-SPECIFIC: Double-nested suspend

10. **should not execute incorrect branches after resuming from suspended nested workflow**
    - ENGINE-SPECIFIC: Branch correctness after resume

11. **should maintain correct step status after resuming in branching workflows - #6419**
    - BUG FIX: Keep as regression test

12-14. **Abort signal propagation tests**
    - ENGINE-SPECIFIC: Abort propagation to nested

---

## DEPENDENCY INJECTION (4 tests, Lines 15212-15454)

ALL ENGINE-SPECIFIC - RequestContext DI

1. **should work with requestContext - bug #4442**
2. **should work with custom requestContext - bug #4442**
3. **should have access to requestContext from before suspension during workflow resume**
4. **should not show removed requestContext values in subsequent steps**

---

## ADDITIONAL FEATURES (15 tests, Lines 15454-16607)

ALL ENGINE-SPECIFIC

1. **should support consecutive parallel calls with proper type inference**
2. **runCount should exist and equal zero for the first run**
3. **multiple steps should have different run counts**
4. **should remain suspended when only one of multiple parallel suspended steps is resumed - #6418**
5. **should throw error when multiple steps are suspended and no step specified**
6. **should provide full TypeScript support for tracingContext**
7. **should provide access to suspendData in workflow step on resume**
8. **should bubble up tripwire from agent input processor to workflow result**
9. **should return tripwire status when streaming agent in workflow**
10. **should handle tripwire from output stream processor in agent within workflow**
11. **should pass structured output from agent step to next step with correct types**
12-18. **Callback tests (onFinish, onError, resourceId, state, mastra instance)**

---

## TESTS TO REMOVE (Duplicates of Shared Suite)

Based on analysis, these ~42 tests are covered by the shared suite:

### Streaming (10):
- should generate a stream (x2)
- should handle sleep waiting flow (x4)
- should handle sleep waiting flow with fn parameter (x2)
- should be able to use an agent as a step (x2)

### Basic Execution (12):
- should execute a single step nested workflow successfully with state
- should execute a single step nested workflow successfully with state being set
- should execute a single step in a nested workflow when perStep is true
- should execute only one step when there are multiple steps in parallel and perStep is true
- should execute a a sleep step (typo)
- should execute a a sleep until step (typo)
- should execute a sleep until step with fn parameter
- should complete parallel workflow when steps do not suspend
- should follow conditional chains and run only one step when perStep is true

### Suspend/Resume (8):
- should handle basic suspend and resume in a dountil workflow
- should support both explicit step resume and auto-resume
- should have access to correct inputValue when resuming a step preceded by a .map step
- should preserve state across suspend and resume cycles
- should auto-resume simple suspended step

### Foreach (2):
- should run a all item concurrency for loop
- should run a partial item concurrency for loop

### Nested (5):
- should be able to nest workflows
- should be able to nest workflows with conditions
- should handle consecutive nested workflows with suspend/resume

### Schema/Validation (5):
- Zod v4 duplicate tests (4)
- Basic validation

---

## TESTS TO KEEP (Engine-Specific)

### Unique Features (~100 tests):
- Restart (5) - Entire domain
- TimeTravel validation (13) - Error cases and variations
- RequestContext DI (4)
- Writer API (2)
- Tripwire (3)
- If-else branching API (3)
- Foreach index/label resume (4)
- Mastra registration (4)
- Abort propagation (3)
- Callbacks (7)
- Run count (2)
- Snapshot behavior (3)
- And more...

### Bug Regression Tests (8):
- #4442, #5650, #6418, #6419, #6669, #11313
