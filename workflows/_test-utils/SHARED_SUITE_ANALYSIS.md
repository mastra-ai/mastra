# Shared Workflow Test Suite - Detailed Analysis

Extracted from: `workflows/_test-utils/src/domains/*.ts`

---

## suspend-resume (25 tests)

**File:** `workflows/_test-utils/src/domains/suspend-resume.ts`

**Purpose:** Tests suspend/resume workflow feature including basic suspend, resume with data, state persistence, conditional branches, parallel workflows, nested workflow propagation.

### Tests:

1. **should return the correct runId**
   - Tests: Basic workflow returns correct runId
   - Setup: Simple 1-step workflow
   - Features: Basic execution

2. **should suspend workflow when suspend is called**
   - Tests: Step can suspend via `suspend()` with reason payload
   - Setup: 2-step workflow, step2 calls suspend
   - Assertions: Status 'suspended', suspendPayload present, step3 not executed

3. **should handle suspend with empty payload**
   - Tests: Suspend without arguments works
   - Setup: 1-step workflow suspends with no data
   - Features: suspend (empty)

4. **should suspend with typed payload and suspendSchema**
   - Tests: Suspend with typed data via suspendSchema validation
   - Setup: 1-step workflow with suspendSchema
   - Features: suspendSchema, typed suspend

5. **should not execute steps after suspended step**
   - Tests: Execution halts at suspend point
   - Setup: 3-step linear, step2 suspends
   - Assertions: step1/step2 execute, step3 never executes

6. **should handle suspend in conditional branch**
   - Tests: Suspend within branching logic
   - Setup: Check → branch (approval suspends vs autoApprove)
   - Features: branch, suspend

7. **should suspend workflow with state modifications**
   - Tests: State preservation during suspend
   - Setup: 3-step with stateSchema, step2 sets state then suspends
   - Features: state, setState, suspend

8. **should remain suspended when one of parallel steps suspends**
   - Tests: Parallel execution halts if any step suspends
   - Setup: 2 parallel steps (normal + suspend)
   - Features: parallel, suspend

9. **should complete parallel workflow when no steps suspend**
   - Tests: Parallel steps complete without suspend
   - Setup: 2 parallel steps returning numbers
   - Features: parallel (no suspend)

10. **should propagate suspend from nested workflow**
    - Tests: Nested workflow suspension bubbles up
    - Setup: Parent → nested (inner suspends)
    - Features: nested workflows, suspend propagation

11. **should handle basic suspend and resume flow** (requires resume)
    - Tests: Resume with resumeData after suspend
    - Setup: 2-step, step2 suspends then resumes
    - Features: suspend, resume, resumeData

12. **should handle suspend and resume using resumeLabel**
    - Tests: Resume via resumeLabel instead of step parameter
    - Features: resumeLabel option, label-based resume

13. **should preserve state across suspend and resume cycles**
    - Tests: State modifications persist through suspend/resume
    - Features: state, setState, suspend, resume

14. **should handle multiple suspend/resume cycles in parallel workflow**
    - Tests: Multiple parallel steps each suspend/resume independently
    - Features: parallel, multiple resumes

15. **should support both explicit step resume and auto-resume**
    - Tests: Resume with or without explicit step parameter
    - Features: auto-detect suspended step

16. **should maintain correct step status after resuming in branching workflows**
    - Tests: Branch steps track status correctly across resumes
    - Features: branch, multiple suspends, per-step resume

17. **should be able to resume suspended nested workflow step**
    - Tests: Nested workflow suspend can be resumed
    - Features: nested workflows, suspend/resume

18. **should handle basic suspend and resume in a dountil workflow**
    - Tests: Suspend/resume within loop continues iterations
    - Features: dountil, suspend, nested workflow

19. **should have access to correct input value when resuming in a loop**
    - Tests: Loop variable state maintained during suspend/resume
    - Features: dountil, resumeData, loop variable access

20. **should have access to correct inputValue when resuming a step preceded by a .map step**
    - Tests: Input preservation through map transformations and suspend/resume
    - Features: map step, suspend, resume

21. **should suspend and resume in foreach loop**
    - Tests: Foreach iteration suspension with per-item resume
    - Features: foreach, per-item resume

22. **should suspend and resume when running concurrent foreach**
    - Tests: Concurrent foreach suspension with selective resume
    - Features: foreach with concurrency, suspend

23. **should suspend and resume with forEachIndex**
    - Tests: Resume specific foreach iteration by index
    - Features: foreach, forEachIndex parameter

24. **should handle consecutive nested workflows with suspend/resume**
    - Tests: Multiple nested workflows in sequence with suspend/resume
    - Features: consecutive nested workflows

25. **should throw error when multiple steps are suspended and no step specified**
    - Tests: Error for ambiguous resume
    - Features: suspend error handling

---

## time-travel (14 tests)

**File:** `workflows/_test-utils/src/domains/time-travel.ts`

**Purpose:** Tests sleep/sleepUntil delays and timeTravel debugging API for workflow replay.

### Sleep Tests:

1. **should execute a sleep step**
   - Tests: Workflow pauses for specified milliseconds
   - Setup: step1 → sleep(100) → step2
   - Assertions: Takes >= 90ms

2. **should execute a sleep step with fn parameter**
   - Tests: Sleep duration computed dynamically
   - Setup: step1 (returns 100) → sleep(fn) → step2
   - Features: sleep with function, getStepResult

3. **should handle sleep in conditional branch**
   - Tests: Sleep only in taken branch
   - Setup: check → branch (sleep vs no-sleep)

4. **should preserve step results across sleep**
   - Tests: Step outputs available after sleep
   - Features: sleep, getStepResult across sleep

5. **should execute a sleepUntil step**
   - Tests: Workflow pauses until timestamp
   - Features: sleepUntil with static date

6. **should execute a sleepUntil step with fn parameter**
   - Tests: Sleep until dynamically computed timestamp
   - Features: sleepUntil with function

### TimeTravel Tests (require timeTravel API):

7. **should timeTravel a workflow execution**
   - Tests: Jump to step2 with pre-populated context
   - Setup: 3-step linear, timeTravel to step2
   - Assertions: step1 not called, step2/3 called

8. **should timeTravel workflow execution for workflow with parallel steps**
   - Tests: TimeTravel to final step skipping parallel
   - Features: timeTravel with parallel

9. **should timeTravel and run only one step when perStep is true**
   - Tests: TimeTravel + perStep executes only target step
   - Features: timeTravel, perStep option

10. **should timeTravel a workflow execution that was previously ran**
    - Tests: Normal run then timeTravel with different context
    - Features: timeTravel, context override

11. **should timeTravel a workflow execution that has nested workflows**
    - Tests: TimeTravel through nested workflow boundaries
    - Features: timeTravel with nested workflows

12. **should successfully suspend and resume a timeTravelled workflow**
    - Tests: TimeTravel to suspend step
    - Features: timeTravel, suspend interaction

13. **should timeTravel to step in conditional chains**
    - Tests: TimeTravel to conditional branch with condition context
    - Features: timeTravel with conditions

14. **should timeTravel workflow execution for a do-until workflow**
    - Tests: TimeTravel past loop iterations
    - Features: timeTravel with loops

---

## foreach (6 tests)

**File:** `workflows/_test-utils/src/domains/foreach.ts`

**Purpose:** Tests iteration over arrays with different concurrency modes.

1. **should run a single item concurrency (default) for loop**
   - Tests: Sequential execution (default concurrency=1)
   - Setup: foreach → final, 3 items, each ~1s
   - Assertions: Duration ~3s

2. **should run a concurrent for loop**
   - Tests: Parallel execution with concurrency=3
   - Assertions: Duration ~1s (parallel)

3. **should run a partial concurrency for loop**
   - Tests: Batched execution with concurrency=2 for 4 items
   - Assertions: Duration ~2 batches

4. **should handle empty array in foreach**
   - Tests: Empty array skips map step
   - Assertions: Empty output, count 0

5. **should chain steps before foreach and aggregate results after**
   - Tests: step → foreach → step pattern
   - Features: foreach chaining

6. **should aggregate results correctly from foreach iterations**
   - Tests: Complex aggregation after foreach
   - Features: foreach with aggregation

---

## loops (4 tests)

**File:** `workflows/_test-utils/src/domains/loops.ts`

1. **should run an until loop**
   - Tests: dountil exits when condition true
   - Setup: dountil(increment) until >= 12

2. **should run a while loop**
   - Tests: dowhile runs while condition true
   - Setup: dowhile(increment) while < 12

3. **should exit loop immediately when condition is already met**
   - Tests: dowhile runs at least once
   - Features: dowhile semantics (do-first)

4. **should accumulate data across loop iterations**
   - Tests: Loop state accumulates array
   - Features: dountil with state accumulation

---

## nested-workflows (7 tests)

**File:** `workflows/_test-utils/src/domains/nested-workflows.ts`

1. **should execute nested workflow as a step**
   - Tests: Nested workflow as single step

2. **should handle failing steps in nested workflows**
   - Tests: Error bubbles up from nested
   - Features: error propagation

3. **should pass data between parent and nested workflow**
   - Tests: Output from parent input to nested

4. **should execute nested workflow with conditions**
   - Tests: Nested workflow with branching

5. **should handle multiple levels of nesting**
   - Tests: 3-level nesting (outer → middle → inner)

6. **should execute nested workflow with state**
   - Tests: State accessible in nested

7. **should execute nested workflow with state being set by nested workflow**
   - Tests: Nested modifies parent state

---

## per-step (5 tests)

**File:** `workflows/_test-utils/src/domains/per-step.ts`

1. **should execute only first step when perStep is true**
   - Tests: perStep pauses after each step
   - Assertions: Status 'paused', step1 only

2. **should execute only one step in parallel workflow when perStep is true**
   - Tests: perStep in parallel executes first only

3. **should execute only check step in conditional when perStep is true**
   - Tests: perStep halts before branch evaluation

4. **should execute only outer step in nested workflow when perStep is true**
   - Tests: perStep halts at nested boundary

5. **should continue execution step by step with multiple perStep calls**
   - Tests: Multiple perStep calls execute sequentially

---

## streaming (5 tests)

**File:** `workflows/_test-utils/src/domains/streaming.ts`

1. **should execute workflow that could be streamed**
   - Tests: Basic workflow for streaming

2. **should track step execution order in workflow result**
   - Tests: Deterministic step order

3. **should execute workflow with state that could be streamed**
   - Tests: State modifications traceable

4. **should execute workflow with parallel steps that could be streamed**
   - Tests: Parallel execution for streaming

5. **should execute workflow that suspends (streamable without closing)**
   - Tests: Suspend is streamable

---

## Other Domains

### abort (6 tests)
- Abort function to step
- Abort signal to step
- Prepare for immediate abort
- Suspend workflow that can be canceled
- Abort status (skipIf)
- Abort signal during step (skipIf)

### agent-step (8 tests)
- Agent-like step execution
- Error handling
- Agent with options
- Chaining before/after
- Parallel agents
- Nested workflows with agents

### basic-execution (10 tests)
- Single step, multiple steps
- Parallel, multiple runs
- Input data, runId

### branching (6 tests)
- If-then, else branch
- Data to branches
- Three-way branching

### callbacks (10 tests)
- onFinish, onError callbacks
- State, runId, resourceId in callbacks
- Async callbacks
- GetInitData, logger, requestContext

### error-handling (6 tests)
- Step errors, nested errors
- Parallel errors, variable resolution errors
- Error cause chain

### variable-resolution (14 tests)
- Trigger data, previous steps
- .map() with constants, dynamic, arrays
- Step result helpers

### And more: clone, complex-conditions, dependency-injection, interoperability, restart, retry, run-count, schema-validation, simple-conditions, storage, tracing, workflow-runs

---

## TOTAL: ~150 tests across all domains
