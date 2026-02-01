# Missing Tests from Shared Suite

## Summary

**Current State:**
- Default Engine tests: 216 unique tests
- Evented Engine tests: 203 unique tests
- Common to both: 190 tests
- Shared Suite: 148 unique tests
- **Missing from Shared: 121 tests**

---

## Missing Tests by Category

### 1. TimeTravel (14 tests) - HIGH PRIORITY
Current shared suite only has basic sleep tests, missing actual time travel functionality.

```
should successfully suspend and resume a timeTravelled workflow execution
should throw error if trying to timetravel a workflow execution that is still running
should throw error if trying to timetravel to a non-existent step
should throw error if validateInputs is true and trying to timetravel a workflow execution with invalid inputData
should timetravel a suspended workflow execution
should timeTravel a workflow execution and run only one step when perStep is true
should timeTravel a workflow execution that has nested workflows
should timeTravel a workflow execution that was previously ran
should timeTravel a workflow execution that was previously ran and run only one step when perStep is true
should timeTravel to step in conditional chains
should timeTravel to step in conditional chains and run just one step when perStep is true
should timeTravel workflow execution for a do-until workflow
should timeTravel workflow execution for workflow with parallel steps
should timeTravel workflow execution for workflow with parallel steps and run just the timeTravelled step when perStep is true
```

### 2. Suspend/Resume Advanced (30 tests) - HIGH PRIORITY
Many advanced resume scenarios not yet in shared suite.

```
should auto-resume simple suspended step without specifying step parameter
should be able to suspend nested workflow step
should be able to suspend nested workflow step in a nested workflow step
should complete parallel workflow when steps do not suspend
should handle basic suspend and resume flow using resumeLabel
should handle basic suspend and resume flow with async await syntax
should handle basic suspend and resume flow with async await syntax with state
should handle basic suspend and resume in a dountil workflow
should handle basic suspend and resume single step flow with async await syntax and perStep:true
should handle consecutive nested workflows with suspend/resume
should have access to requestContext from before suspension during workflow resume
should have access to the correct inputValue when resuming a step preceded by a .map step
should preserve input property from snapshot context after resume
should preserve request context in nested workflows after suspend/resume
should preserve resourceId when resuming a suspended workflow
should preserve state across suspend and resume cycles
should provide access to suspendData in workflow step on resume
should support both explicit step resume and auto-resume (backwards compatibility)
should suspend and resume provided index when running a partial item concurrency for loop
should suspend and resume provided index when running all items concurrency for loop
should suspend and resume provided label when running all items concurrency for loop
should suspend and resume when running a partial item concurrency for loop
should suspend and resume when running a single item concurrency (default) for loop
should suspend and resume when running all items concurrency for loop
should throw error when you try to resume a workflow step that is not suspended
should throw error when you try to resume a workflow that is not suspended
```

### 3. Nested Workflows (17 tests) - MEDIUM PRIORITY
Several nested workflow scenarios missing.

```
should be able to nest workflows
should be able to nest workflows with conditions
should execute a single step nested workflow successfully with state
should execute a single step nested workflow successfully with state being set by the nested workflow
should preserve request context in nested workflows after suspend/resume
should propagate abort signal to agent step in nested workflow when parent is cancelled
should propagate abort signal to nested workflow when using run.abortController.abort() directly
should propagate abort signal to nested workflow when using run.cancel()
should return workflow run execution result with nested workflow steps information
should throw error if inputData is invalid in nested workflows
should timeTravel a workflow execution that has nested workflows
```

### 4. Agent Tests (11 tests) - MEDIUM PRIORITY
Agent integration tests.

```
should be able to use an agent as a step
should be able to use an agent as a step in nested workflow via mastra instance
should be able to use an agent as a step via mastra instance
should be able to use an agent in parallel
should be able to use an agent with v1 model as a step
should bubble up tripwire from agent input processor to workflow result
should handle errors from agent.stream() with full error details
should handle tripwire from output stream processor in agent within workflow
should pass agentOptions when wrapping agent with createStep
should pass structured output from agent step to next step with correct types
should propagate abort signal to agent step in nested workflow when parent is cancelled
```

### 5. Foreach with Suspend (11 tests) - MEDIUM PRIORITY

```
should bail foreach execution when called in a concurrent batch
should run a all item concurrency for loop
should run a partial item concurrency for loop
should suspend and resume provided index when running a partial item concurrency for loop
should suspend and resume provided index when running all items concurrency for loop
should suspend and resume provided label when running all items concurrency for loop
should suspend and resume when running a partial item concurrency for loop
should suspend and resume when running a single item concurrency (default) for loop
should suspend and resume when running all items concurrency for loop
should update state after each concurrent batch in foreach step
```

### 6. perStep Mode (9 tests) - MEDIUM PRIORITY

```
should execute a single step in a nested workflow when perStep is true
should execute only one step when there are multiple steps in parallel and perStep is true
should follow conditional chains and run only one step when perStep is true
should generate a stream for a single step when perStep is true
should handle basic suspend and resume single step flow with async await syntax and perStep:true
should timeTravel a workflow execution and run only one step when perStep is true
should timeTravel a workflow execution that was previously ran and run only one step when perStep is true
should timeTravel to step in conditional chains and run just one step when perStep is true
should timeTravel workflow execution for workflow with parallel steps and run just the timeTravelled step when perStep is true
```

### 7. State Management (8 tests) - MEDIUM PRIORITY

```
should execute a single step nested workflow successfully with state
should execute a single step nested workflow successfully with state being set by the nested workflow
should generate a stream for a single step workflow successfully with state
should handle basic suspend and resume flow with async await syntax with state
should preserve state across suspend and resume cycles
should properly update state when executing multiple steps in parallel
should provide state in onError callback
should update state after each concurrent batch in foreach step
```

### 8. Callbacks (7 tests) - LOW PRIORITY (some already exist)

```
should call both onFinish and onError when workflow fails and both are defined
should call onFinish callback when workflow completes successfully
should call onFinish callback when workflow fails
should provide mastra instance in onError callback
should provide mastra instance in onFinish callback
should provide resourceId in onError callback when provided
should provide state in onError callback
```

### 9. RequestContext (7 tests) - MEDIUM PRIORITY

```
should have access to requestContext from before suspension during workflow resume
should inject requestContext dependencies into steps during resume
should inject requestContext dependencies into steps during run
should preserve request context in nested workflows after suspend/resume
should resolve trigger data and DI requestContext values via .map()
should work with custom requestContext - bug #4442
should work with requestContext - bug #4442
```

### 10. Abort/Cancel (7 tests) - LOW PRIORITY (some already exist)

```
should be able to abort workflow execution during a step
should be able to abort workflow execution immediately
should be able to abort workflow execution in between steps
should be able to cancel a suspended workflow
should propagate abort signal to agent step in nested workflow when parent is cancelled
should propagate abort signal to nested workflow when using run.abortController.abort() directly
should propagate abort signal to nested workflow when using run.cancel()
```

### 11. Stream (6 tests) - LOW PRIORITY

```
should generate a stream
should generate a stream for a single step when perStep is true
should generate a stream for a single step workflow successfully with state
should handle errors from agent.stream() with full error details
should handle tripwire from output stream processor in agent within workflow
should preserve error details in streaming workflow
```

### 12. Sleep (5 tests) - LOW PRIORITY

```
should execute a a sleep step
should execute a a sleep until step
should execute a sleep until step with fn parameter
should handle sleep waiting flow
should handle sleep waiting flow with fn parameter
```

### 13. Storage (5 tests) - LOW PRIORITY

```
should load serialized error from storage via getWorkflowRunById
should return correct status from storage when creating run with existing runId from different workflow instance
should return empty result when mastra is not initialized
should update run status from storage snapshot when run exists in memory map
should use shouldPersistSnapshot option
```

### 14. Other (misc tests)

```
multiple steps should have different run counts
runCount should exist and equal zero for the first run
should automatically commit uncommitted workflow when registering in mastra instance
should be able clone workflows as steps
should be able to spec out workflow result via variables
should execute else-branch
should execute if-branch
should execute nested else and if-branch
should handle custom event emission using writer
should handle step execution errors within branches
should handle writer.custom during resume operations
should have runId in the step execute function - bug #4260
should pass structured output from agent step to next step with correct types
should preserve custom error properties when step throws error with extra fields
should preserve ZodError as cause when input validation fails
should properly validate input schema when .map is used after .foreach. bug #11313
should provide access to step results and trigger data via getStepResult helper
should provide full TypeScript support for tracingContext
should resolve inputs from previous steps that are arrays via .map()
should resolve trigger data from getInitData with workflow schema
should resolve variables from previous steps
should start workflow and complete successfully
should support consecutive parallel calls with proper type inference
should throw error if inputData is invalid in workflow with .map()
should throw error if waitForEvent is used
```

---

## Recommended Priority for Addition

### Phase 1: High Priority (35 tests)
1. **TimeTravel expansion** - 14 tests (critical for debugging/testing)
2. **Suspend/Resume advanced** - 21 most important tests

### Phase 2: Medium Priority (46 tests)
3. **Nested Workflows expansion** - 17 tests
4. **perStep Mode** - 9 tests
5. **Foreach with Suspend** - 11 tests
6. **State Management** - 8 tests

### Phase 3: Lower Priority (40 tests)
7. **Agent Tests** - 11 tests (requires mock LLM setup)
8. **RequestContext** - 7 tests
9. **Abort/Cancel** - 7 tests
10. **Stream** - 6 tests
11. **Storage** - 5 tests
12. **Misc** - ~25 tests

---

## Notes

- Many tests overlap categories (e.g., "timeTravel with perStep" counted in both)
- Some tests may require Mastra instance registration (agent tests)
- Some tests may need mock LLM for agent functionality
- Inngest may need to skip many of these due to architectural differences
