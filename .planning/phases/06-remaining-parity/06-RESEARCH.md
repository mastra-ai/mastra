# Phase 6: Remaining Parity - Research

**Researched:** 2026-01-27
**Domain:** Test Parity Gap Closure
**Confidence:** HIGH

## Summary

This research identifies all remaining test gaps between the default and evented workflow runtimes. Phase 6 closes these gaps to achieve full test parity.

**Gap Analysis:**
- **48 tests** in default runtime not in evented
- **6 restart tests** - explicitly unsupported (design decision)
- **42 actionable tests** to port for full parity

## Missing Tests by Category

### 1. Restart Functionality (6 tests) - OUT OF SCOPE

Evented runtime explicitly throws error for restart(). Design decision, not a gap.

- should restart a workflow execution that was previously active
- should restart a workflow execution that was previously active and has nested workflows
- should restart workflow execution for a do-while workflow
- should restart workflow execution for workflow with parallel steps
- should throw error if trying to restart a workflow execution that was not previously active
- should successfully suspend and resume a restarted workflow execution

### 2. Storage & Run Management (7 tests) - PRIORITY

Storage API and run lifecycle tests:

- runCount should exist and equal zero for the first run
- should get and delete workflow run by id from storage
- should load serialized error from storage via getWorkflowRunById
- should return correct status from storage when creating run with existing runId from different workflow instance
- should return only requested fields when fields option is specified
- should update run status from storage snapshot when run exists in memory map
- should use shouldPersistSnapshot option

### 3. Error Handling & Preservation (5 tests) - PRIORITY

Error serialization and propagation:

- should persist error message without stack trace in snapshot
- should persist MastraError message without stack trace in snapshot
- should preserve custom error properties when step throws error with extra fields
- should preserve error.cause chain in result.error
- should propagate step error to workflow-level error

### 4. Agent Step Features (5 tests)

Agent-related functionality:

- should be able to use an agent with v1 model as a step
- should bubble up tripwire from agent input processor to workflow result
- should handle tripwire from output stream processor in agent within workflow
- should pass agentOptions when wrapping agent with createStep
- should pass structured output from agent step to next step with correct types

### 5. Streaming & Writer (5 tests)

vNext streaming edge cases and writer:

- should continue streaming current run on subsequent stream calls
- should handle custom event emission using writer
- should handle writer.custom during resume operations
- should handle errors from agent.stream() with full error details
- should preserve error details in streaming workflow
- should return tripwire status when streaming agent in workflow

### 6. Sleep Step Variants (3 tests)

Sleep with function parameter:

- should execute a sleep step with fn parameter
- should execute a sleep until step with fn parameter
- should handle sleep waiting flow with fn parameter

### 7. Schema & Validation (3 tests)

Schema defaults and validation:

- should use default value from resumeSchema when resuming a workflow
- should throw error if trigger data is invalid
- should throw error when you try to resume a workflow step with invalid resume data

### 8. Nested Workflow (2 tests)

Nested workflow information:

- should exclude nested workflow steps when withNestedWorkflows is false
- should return workflow run execution result with nested workflow steps information

### 9. ResourceId Preservation (2 tests)

ResourceId handling:

- should persist resourceId when creating workflow runs
- should preserve resourceId when resuming a suspended workflow

### 10. Parallel Execution (2 tests)

Parallel step handling:

- should complete parallel workflow when steps do not suspend
- should properly update snapshot when executing multiple steps in parallel

### 11. Miscellaneous (4 tests)

Various functionality:

- should automatically commit uncommitted workflow when registering in mastra instance
- should bail foreach execution when called in a concurrent batch
- should not show removed requestContext values in subsequent steps
- should only update workflow status to success after all steps have run successfully
- should provide full TypeScript support for tracingContext
- should resolve dynamic mappings via .map() with custom step id

### 12. Already Addressed (1 test)

This test exists in evented but may need verification:

- should throw error when multiple steps are suspended and no step specified (Phase 4-01)

## Complexity Assessment

### Tier 1: Quick Wins (Test-Only) - ~15 tests

Tests where functionality likely already exists:
- Storage API tests (if methods exist)
- Error serialization tests (if serialization works)
- ResourceId tests (may already work)
- Parallel completion tests

### Tier 2: Small Implementations - ~12 tests

Minor code changes needed:
- Sleep with fn parameter (add fn support to sleep step)
- Schema defaults for resume (check if already implemented)
- Foreach bail (may need flag)

### Tier 3: Moderate Work - ~9 tests

Significant implementation:
- Writer functionality (needs writer object in evented)
- Agent step options (v1 model, structured output)
- Nested workflow result information

### Tier 4: Out of Scope - ~6 tests

Intentionally excluded:
- All restart tests

## Implementation Plan Recommendation

### Wave 1: Storage & Error Tests (1 plan)
Port 12 tests for storage API and error handling
- Mostly test-only, verify existing functionality

### Wave 2: Agent & Streaming Tests (1 plan)
Port 10 tests for agent features and streaming edge cases
- May need some implementation for tripwire and writer

### Wave 3: Schema & Sleep Tests (1 plan)
Port 6 tests for schema defaults and sleep variants
- Sleep fn parameter needs implementation

### Wave 4: Nested & Misc Tests (1 plan)
Port 8 tests for nested workflows and miscellaneous
- Foreach bail may need implementation

**Total: 4 plans, ~36 tests to port (excluding restart)**

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/workflows/workflow.test.ts` | Default tests (reference) |
| `packages/core/src/workflows/evented/evented-workflow.test.ts` | Evented tests (target) |
| `packages/core/src/workflows/evented/workflow.ts` | EventedWorkflow class |
| `packages/core/src/workflows/evented/step-executor.ts` | Step execution |

## Success Criteria

1. Port all 36+ actionable tests
2. At least 80% passing (29+ tests)
3. Skipped tests documented with reasons
4. No regressions in existing 172 tests
5. Final test count: 200+ passing

---

_Researched: 2026-01-27_
_Confidence: HIGH - based on direct test file comparison_
