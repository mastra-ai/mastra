# Shared Test Suite - All Test Cases

Extracted from: workflows/_test-utils/src/domains/*.ts

## abort

- should provide abort signal to step execute function
- should provide abort function to step execute function
- should abort workflow when abort function is called
- should prepare workflow for immediate abort
- should provide abort signal that can be listened to during step execution
- should suspend workflow that can be canceled

## agent-step

- should execute workflow with step that simulates agent behavior
- should chain steps before and after agent-like step
- should handle agent step errors gracefully
- should execute agent-like steps in parallel
- should execute agent-like nested workflow as a step
- should handle agent-like step in deeply nested workflow
- should pass options through to agent-like step

## basic-execution

- should execute a single step workflow successfully
- should start workflow and complete successfully
- should execute multiple runs of a workflow
- should execute a single step workflow successfully with state
- should execute multiple steps in sequence
- should execute multiple steps in parallel
- should be able to bail workflow execution
- should have runId in the step execute function
- should execute multiple steps in parallel with state
- should have access to typed workflow results
- should pass input data through to steps
- should throw error when execution flow not defined
- should throw error when execution graph is not committed
- should handle missing suspendData gracefully

## branching

- should run the if-then branch
- should run the else branch
- should handle three-way branching - low path
- should handle three-way branching - medium path
- should handle three-way branching - high path
- should pass correct data to selected branch - true path
- should pass correct data to selected branch - false path

## callbacks

- should call onFinish callback when workflow succeeds
- should call onError callback when workflow fails
- should pass workflow result to onFinish callback
- should not call onError callback when workflow succeeds
- should support async onFinish callback
- should support async onError callback
- should provide runId in onFinish callback
- should provide workflowId in onFinish callback
- should provide state in onFinish callback
- should provide resourceId in onFinish callback when provided
- should provide runId in onError callback
- should provide workflowId in onError callback
- should call onFinish with suspended status when workflow suspends
- should provide getInitData function in onFinish callback
- should provide getInitData function in onError callback
- should provide logger in onFinish callback
- should provide logger in onError callback
- should provide requestContext in onFinish callback
- should provide requestContext in onError callback

## clone


## complex-conditions

- should handle nested AND/OR conditions

## dependency-injection

- should provide requestContext to step execute function
- should propagate requestContext values through workflow steps

## error-handling

- should handle step execution errors
- should handle variable resolution errors
- should handle step execution errors within parallel branches
- should propagate step error to workflow-level error
- should handle step execution errors within nested workflows
- should preserve error.cause chain in result.error

## foreach

- should run a single item concurrency (default) for loop
- should run a concurrent for loop
- should run a partial concurrency for loop
- should handle empty array in foreach
- should chain steps before foreach and aggregate results after
- should aggregate results correctly from foreach iterations

## interoperability

- should be able to use all action types in a workflow

## loops

- should run an until loop
- should run a while loop
- should exit loop immediately when condition is already met
- should accumulate data across loop iterations

## multiple-chains

- should run multiple chains in parallel

## nested-workflows

- should execute nested workflow as a step
- should handle failing steps in nested workflows
- should pass data between parent and nested workflow
- should execute nested workflow with conditions
- should handle multiple levels of nesting
- should execute nested workflow with state
- should execute nested workflow with state being set by the nested workflow

## per-step

- should execute only first step when perStep is true
- should execute only one step in parallel workflow when perStep is true
- should execute only check step in conditional when perStep is true
- should execute only outer step in nested workflow when perStep is true
- should continue execution step by step with multiple perStep calls

## restart

- should throw error when restarting workflow that was never started
- should restart a completed workflow execution
- should restart workflow with multiple steps
- should restart a failed workflow and succeed on retry

## retry

- should retry a step default 0 times
- should retry a step with a custom retry config
- should retry a step with step retries option, overriding the workflow retry config

## run-count

- retryCount should exist and equal zero for the first run
- multiple steps should have different run counts in loops

## schema-validation

- should throw error if trigger data is invalid
- should use default value from inputSchema
- should throw error if inputData is invalid
- should use default value from inputSchema for step input
- should allow a steps input schema to be a subset of the previous step output schema

## simple-conditions

- should follow conditional chains
- should follow conditional chains with state
- should handle failing dependencies
- should support simple string conditions
- should support custom condition functions

## storage

- should get workflow runs from storage
- should get and delete workflow run by id from storage
- should persist resourceId when creating workflow runs
- should return only requested fields when fields option is specified
- should exclude nested workflow steps when withNestedWorkflows is false

## streaming

- should execute workflow that could be streamed
- should track step execution order in workflow result
- should execute workflow with state that could be streamed
- should execute workflow with parallel steps that could be streamed
- should execute workflow that suspends (streamable without closing)

## suspend-resume

- should return the correct runId
- should suspend workflow when suspend is called
- should handle suspend with empty payload
- should suspend with typed payload and suspendSchema
- should not execute steps after suspended step
- should handle suspend in conditional branch
- should suspend workflow with state modifications
- should remain suspended when one of parallel steps suspends
- should complete parallel workflow when no steps suspend
- should propagate suspend from nested workflow
- should handle basic suspend and resume flow

## time-travel

- should execute a sleep step
- should execute a sleep step with fn parameter
- should handle sleep in conditional branch
- should preserve step results across sleep
- should execute a sleepUntil step
- should execute a sleepUntil step with fn parameter
- should timeTravel a workflow execution

## tracing

- should provide tracingContext to step execution
- should provide tracingContext to all steps in workflow

## variable-resolution

- should resolve trigger data
- should provide access to step results via getStepResult helper
- should resolve trigger data from context
- should resolve trigger data from getInitData
- should resolve variables from previous steps via .map()
- should resolve inputs from previous steps that are not objects
- should resolve inputs from previous steps that are arrays
- should resolve constant values via .map()
- should resolve fully dynamic input via .map()
- should resolve dynamic mappings via .map()
- should resolve dynamic mappings via .map() with custom step id

## workflow-runs

- should track workflow run status
- should track workflow run with multiple steps
- should execute multiple runs of a workflow
- should use provided runId

