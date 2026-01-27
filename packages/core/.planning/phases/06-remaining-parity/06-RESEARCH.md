# Phase 6: Remaining Parity - Research

**Researched:** 2026-01-27
**Domain:** Test gap analysis and feature parity
**Confidence:** HIGH

## Summary

This research provides a comprehensive analysis of the remaining test gaps between the default and evented workflow runtimes. Through systematic comparison of the two test suites, 66 missing tests were identified and categorized into distinct feature areas.

The analysis reveals that approximately 20 tests represent intentionally excluded features (restart functionality and certain foreach concurrency edge cases), 18 tests are already marked as skipped due to known architectural limitations, and the remaining 28 tests represent actual gaps that need to be addressed for full parity.

The key finding is that Phase 6 should focus on the "long tail" of smaller features that don't warrant their own phases: writer functionality (2 tests), sleep with function parameter (3 tests), run count/status tracking, storage operations (get/delete, fields filtering), snapshot persistence options, agent-related features (v1 model support, options passthrough, structured output), error handling improvements, and miscellaneous edge cases.

**Primary recommendation:** Organize Phase 6 into small, independent tasks grouped by feature area, prioritizing quick wins (already implemented but not tested) over complex features that may require significant implementation work.

## Standard Stack

This phase doesn't introduce new libraries. It uses the existing test infrastructure:

### Core Testing Tools

| Library                  | Purpose              | Usage in Phase 6              |
| ------------------------ | -------------------- | ----------------------------- |
| Vitest                   | Test framework       | Writing and running all tests |
| Zod                      | Schema validation    | Test data validation          |
| @internal/ai-sdk-v4/test | Mock language models | Agent-related tests           |

### Testing Patterns Already Established

| Pattern               | Description                      | Relevance               |
| --------------------- | -------------------------------- | ----------------------- |
| MockStore             | In-memory storage implementation | Storage operation tests |
| vi.fn() mocking       | Function mocking and spy         | Verifying behavior      |
| describe/it structure | Test organization                | Maintaining consistency |

## Architecture Patterns

### Test Gap Classification Pattern

Tests fall into three categories:

```typescript
// Category 1: Intentionally Excluded (skip in evented)
it.skip('should restart a workflow...', async () => {
  // Restart is not supported in evented runtime (design decision)
});

// Category 2: Known Limitation (skip with explanation)
it.skip('should handle multiple suspend/resume cycles in parallel...', async () => {
  // NOTE: Evented runtime stops at first suspended step
});

// Category 3: Actual Gap (needs implementation/test)
it('should use shouldPersistSnapshot option', async () => {
  // This IS implemented in evented but not tested
});
```

### Feature Categories Identified

The 66 missing tests break down as follows:

#### 1. Intentionally Excluded (20 tests)

- **Restart functionality (6 tests)**: Design decision - evented runtime doesn't support restart
- **Foreach concurrency suspend/resume (6 tests)**: Known limitation - complex concurrency control not supported
- **Multiple parallel suspends (7 tests)**: Architectural difference - evented stops at first suspend
- **Nested workflow resume edge cases (1 test)**: Related to foreach limitations

#### 2. Already Skipped in Evented (18 tests marked with reasons)

Tests that acknowledge known architectural differences:

- closeOnSuspend behavior differences
- Nested workflow path resolution
- Loop resume input value handling
- Dountil nested workflows
- Branching after resume edge cases

#### 3. Actual Gaps to Address (28 tests)

**Writer functionality (2 tests)**

```typescript
// Feature: Custom event emission during execution
execute: async ({ writer, inputData }) => {
  await writer.write({
    type: 'custom-event',
    payload: { data: inputData },
  });
};
```

**Status:** Writer is stubbed as `undefined` in evented step executor. Implementation needed.

**Sleep with function parameter (3 tests)**

```typescript
// Two variations: sleep(fn) and sleepUntil(fn)
workflow
  .then(step1)
  .sleep(({ context }) => context.delay)
  .then(step2);
workflow
  .then(step1)
  .sleepUntil(({ context }) => context.timestamp)
  .then(step2);
```

**Status:** Only tested with literal milliseconds, not function parameter form.

**Run count/status (1 test)**

```typescript
// Run should track how many times it's been executed
expect(run.runCount).toBe(0); // First run
```

**Status:** `runCount` property not found in Run class.

**Storage operations (3 tests)**

- Get and delete workflow run by ID
- Filter fields when retrieving runs (`fields` option)
- Include/exclude nested workflow steps (`withNestedWorkflows` option)

**Status:** May be partially implemented but not tested in evented.

**Snapshot persistence (2 tests)**

```typescript
// User control over when snapshots are persisted
const workflow = createWorkflow({
  options: {
    shouldPersistSnapshot: ({ workflowStatus, stepResults }) => {
      return workflowStatus === 'suspended'; // Only persist on suspend
    },
  },
});
```

**Status:** Code present in evented workflow (line 1020, 1078, 1090) but not tested.

**Agent step options (3 tests)**

- V1 model support
- AgentOptions passthrough verification
- Structured output handling

**Status:** Some code exists but needs verification through tests.

**Error handling enhancements (7 tests)**

- Tripwire from processors
- Error serialization (no stack trace in snapshots)
- Custom error properties preservation
- MastraError serialization
- Error.cause chain preservation

**Status:** Error handling works but edge cases not tested.

**Miscellaneous (7 tests)**

- Automatic workflow commit when registering
- Foreach bail functionality
- TypeScript support for tracingContext
- ResourceId preservation
- Request context handling
- Parallel execution without suspend
- Status updates

## Don't Hand-Roll

| Problem                     | Why Not Custom                | Use Instead                                                     |
| --------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Test gap analysis           | Manual comparison error-prone | `comm` command on sorted test lists                             |
| Feature categorization      | Manual review misses patterns | grep with regex patterns for systematic classification          |
| Implementation verification | Assumption without proof      | grep for actual code presence before claiming "not implemented" |

**Key insight:** Many "missing" tests may actually be testing already-implemented features. Verification through code search is essential before claiming implementation gaps.

## Common Pitfalls

### Pitfall 1: Assuming Missing Test = Missing Feature

**What goes wrong:** Marking a feature as "not implemented" when it actually exists but is untested
**Why it happens:** Test gap analysis only shows test coverage, not code coverage
**How to avoid:** For each missing test, search the codebase for related code before planning implementation tasks
**Warning signs:** Finding code like `shouldPersistSnapshot` in the evented workflow file

### Pitfall 2: Treating All Skipped Tests the Same

**What goes wrong:** Attempting to implement features that are intentionally excluded
**Why it happens:** Not reading the skip comments or understanding architectural decisions
**How to avoid:** Categorize skips into "intentional exclusion" vs "known limitation to address" vs "temporary skip"
**Warning signs:** Skip comments mentioning "design decision" or "intentional"

### Pitfall 3: Over-Ambitious Scope for Final Phase

**What goes wrong:** Trying to achieve 100% test parity when architectural differences make it impossible
**Why it happens:** Misunderstanding the goal - parity means "equivalent functionality" not "identical tests"
**How to avoid:** Define success criteria that exclude intentionally different behaviors
**Warning signs:** Planning to implement features that were explicitly excluded in Phase 0

### Pitfall 4: Ignoring Test Organization

**What goes wrong:** Adding tests in wrong locations or without proper describe blocks
**Why it happens:** Focus on test content without considering structure
**How to avoid:** Match the describe block hierarchy from default tests
**Warning signs:** Difficulty finding related tests during code review

## Code Examples

### Pattern 1: Verifying Feature Exists Before Implementing

```bash
# Before claiming "writer not implemented", search for it:
grep -r "writer" src/workflows/evented/

# Result shows writer is stubbed:
# step-executor.ts:149:  writer: undefined as any,

# Conclusion: Writer needs implementation, not just testing
```

### Pattern 2: Categorizing Skipped Tests

```typescript
// From evented-workflow.test.ts analysis:

// Category A: Design decision - document and skip
it.skip('should restart workflow...', async () => {
  // NOTE: Restart is intentionally not supported in evented runtime
});

// Category B: Known limitation - may address in future
it.skip('should handle multiple parallel suspends...', async () => {
  // NOTE: Evented runtime stops at first suspended step
  // This is a limitation of the event-driven architecture
});

// Category C: Temporary skip - needs implementation
it.skip('should throw error when resume data is invalid (Phase 4)', async () => {
  // This SHOULD work but implementation incomplete
});
```

### Pattern 3: Testing Already-Implemented Features

```typescript
// shouldPersistSnapshot exists in code but isn't tested
// From workflow.ts line 1020:
shouldPersistSnapshot: (params.options?.shouldPersistSnapshot ?? (() => true),
  // Test to add:
  it('should use shouldPersistSnapshot option', async () => {
    let persistCalls = 0;
    const workflow = createWorkflow({
      id: 'test-persist',
      options: {
        shouldPersistSnapshot: ({ workflowStatus }) => {
          persistCalls++;
          return workflowStatus === 'suspended';
        },
      },
    });

    // Execute and verify persistCalls incremented correctly
  }));
```

### Pattern 4: Adapting Tests for Architectural Differences

```typescript
// Default runtime test:
it('should handle multiple parallel suspends', async () => {
  // Test assumes workflow continues after first suspend
  // and suspends again in parallel branch
});

// Evented adaptation:
it('should stop at first suspend in parallel execution', async () => {
  // Test verifies DIFFERENT behavior that aligns with architecture
  // This is parity - equivalent functionality, different mechanism
});
```

## State of the Art

| Default Runtime Approach                            | Evented Runtime Approach                  | Implications                      |
| --------------------------------------------------- | ----------------------------------------- | --------------------------------- |
| Single execution loop processes all steps           | Event-driven, pubsub-based step execution | Some parallel patterns differ     |
| Writer object available in execute context          | Writer stubbed as undefined               | Writer needs implementation       |
| Supports workflow restart                           | No restart support                        | Intentional exclusion             |
| Continues execution after suspend in parallel paths | Stops at first suspend                    | Architectural difference          |
| Run count tracking                                  | No run count property                     | Implementation needed if required |

**Deprecated/outdated:**

- N/A - this is gap analysis, not version comparison

## Open Questions

1. **Writer functionality priority**
   - What we know: Writer is stubbed in evented runtime
   - What's unclear: Is writer functionality actually used in production? Is it worth implementing?
   - Recommendation: Survey existing workflows for writer usage before implementing

2. **Run count necessity**
   - What we know: Default runtime has runCount property
   - What's unclear: What is runCount used for? Is it just for testing or does it have production use cases?
   - Recommendation: Review use cases before implementing; may be test-only artifact

3. **Foreach concurrency limitations**
   - What we know: 6 foreach suspend/resume tests are skipped
   - What's unclear: Are these edge cases needed in practice? Can they be worked around?
   - Recommendation: Document workarounds for users rather than implementing complex concurrency control

4. **Error serialization scope**
   - What we know: 7 error-related tests missing
   - What's unclear: Which error edge cases are critical vs nice-to-have?
   - Recommendation: Prioritize stack trace removal (security) over other error edge cases

5. **TypeScript support for tracingContext**
   - What we know: One test for "full TypeScript support"
   - What's unclear: What specific TypeScript issue does this test address? Type inference? Type safety?
   - Recommendation: Examine the test implementation to understand what "full support" means

## Sources

### Primary (HIGH confidence)

- Codebase analysis: src/workflows/workflow.test.ts (default runtime - 216 unique tests)
- Codebase analysis: src/workflows/evented/evented-workflow.test.ts (evented runtime - 167 tests, 18 skipped)
- Direct code inspection: src/workflows/evented/workflow.ts (EventedWorkflow and EventedRun implementation)
- Direct code inspection: src/workflows/evented/step-executor.ts (writer stubbing verification)
- Git commit history: Phase documentation from prior phases (context on intentional exclusions)

### Secondary (MEDIUM confidence)

- Test gap analysis: `comm` command comparison yielding 66 missing tests
- Skip comment analysis: Reasons documented in skipped tests
- Code search: grep analysis for feature presence/absence

### Tertiary (LOW confidence)

- N/A - all findings based on direct code inspection

## Metadata

**Confidence breakdown:**

- Test gap identification: HIGH - Direct comparison of test files
- Feature categorization: HIGH - Based on skip comments and code analysis
- Implementation status: MEDIUM - Code presence verified but not execution tested
- Priority recommendations: MEDIUM - Based on analysis but without user feedback on feature importance

**Research date:** 2026-01-27
**Valid until:** 30 days (stable codebase, slow-moving domain)

## Detailed Test Breakdown

### Complete List of 66 Missing Tests

#### Intentionally Excluded (20 tests)

**Restart functionality (6 tests) - EXCLUDE FROM SCOPE**

1. should restart a workflow execution that was previously active
2. should restart a workflow execution that was previously active and has nested workflows
3. should restart workflow execution for a do-while workflow
4. should restart workflow execution for workflow with parallel steps
5. should successfully suspend and resume a restarted workflow execution
6. should throw error if trying to restart a workflow execution that was not previously active

**Foreach concurrency (6 tests) - EXCLUDE FROM SCOPE** 7. should suspend and resume when running a single item concurrency (default) for loop 8. should suspend and resume when running all items concurrency for loop 9. should suspend and resume provided index when running all items concurrency for loop 10. should suspend and resume provided label when running all items concurrency for loop 11. should suspend and resume when running a partial item concurrency for loop 12. should suspend and resume provided index when running a partial item concurrency for loop

**Multiple parallel suspends (7 tests) - ALREADY SKIPPED** 13. should throw error when multiple steps are suspended and no step specified 14. should handle basic suspend and resume in nested dountil workflow - bug #5650 15. should handle multiple suspend/resume cycles in parallel workflow 16. should have access to the correct input value when resuming in a loop. bug #6669 17. should maintain correct step status after resuming in branching workflows - #6419 18. should not execute incorrect branches after resuming from suspended nested workflow 19. should remain suspended when only one of multiple parallel suspended steps is resumed - #6418

**Nested workflow edge case (1 test) - ALREADY SKIPPED** 20. should be able to resume suspended nested workflow step with only nested workflow step provided

#### Actual Gaps to Address (46 tests)

**Writer functionality (2 tests)** 21. should handle custom event emission using writer 22. should handle writer.custom during resume operations

**Sleep with function parameter (3 tests)** 23. should execute a sleep step with fn parameter 24. should execute a sleep until step with fn parameter 25. should handle sleep waiting flow with fn parameter

**Run count/status (1 test)** 26. runCount should exist and equal zero for the first run

**Storage operations (3 tests)** 27. should get and delete workflow run by id from storage 28. should return only requested fields when fields option is specified 29. should return workflow run execution result with nested workflow steps information

**Snapshot persistence (2 tests)** 30. should use shouldPersistSnapshot option 31. should properly update snapshot when executing multiple steps in parallel

**Agent step features (3 tests)** 32. should be able to use an agent with v1 model as a step 33. should pass agentOptions when wrapping agent with createStep 34. should pass structured output from agent step to next step with correct types

**Error handling (9 tests - some overlap with other categories)** 35. should bubble up tripwire from agent input processor to workflow result 36. should handle errors from agent.stream() with full error details 37. should handle tripwire from output stream processor in agent within workflow 38. should load serialized error from storage via getWorkflowRunById 39. should persist error message without stack trace in snapshot 40. should persist MastraError message without stack trace in snapshot 41. should preserve custom error properties when step throws error with extra fields 42. should preserve error details in streaming workflow 43. should preserve error.cause chain in result.error 44. should propagate step error to workflow-level error 45. should return tripwire status when streaming agent in workflow 46. should throw error if trigger data is invalid

**ResourceId persistence (2 tests)** 47. should persist resourceId when creating workflow runs 48. should preserve resourceId when resuming a suspended workflow

**Miscellaneous execution (10 tests)** 49. should follow conditional chains with state 50. should handle consecutive nested workflows with suspend/resume 51. should preserve request context in nested workflows after suspend/resume 52. should resolve dynamic mappings via .map() with custom step id 53. should automatically commit uncommitted workflow when registering in mastra instance 54. should bail foreach execution when called in a concurrent batch 55. should complete parallel workflow when steps do not suspend 56. should continue streaming current run on subsequent stream calls 57. should exclude nested workflow steps when withNestedWorkflows is false 58. should handle basic suspend and resume flow that does not close on suspend 59. should not show removed requestContext values in subsequent steps 60. should only update workflow status to success after all steps have run successfully

**Validation and defaults (3 tests)** 61. should throw error when you try to resume a workflow step with invalid resume data 62. should use default value from resumeSchema when resuming a workflow 63. should auto-resume simple suspended step without specifying step parameter

**Storage and status (3 tests)** 64. should return correct status from storage when creating run with existing runId from different workflow instance 65. should update run status from storage snapshot when run exists in memory map 66. should provide full TypeScript support for tracingContext

## Planning Recommendations

### Complexity Tiers

**Tier 1: Quick Wins (Test-Only) - 8 tests**
Features already implemented, just need tests:

- shouldPersistSnapshot option (code present)
- resourceId persistence (code present)
- closeOnSuspend behavior (code present, needs verification)
- Storage snapshot updates (code present)
- Status tracking (code present)
- Auto-resume detection (may exist)
- Error serialization (may exist)
- TypeScript tracingContext (type checking, not runtime)

**Tier 2: Small Implementations - 15 tests**
Features needing minor code changes:

- Sleep with function parameter (parser modification)
- Storage field filtering (query modification)
- Agent v1 model support (adapter addition)
- Agent options passthrough (parameter forwarding)
- Structured output preservation (type flow)
- Error detail preservation (serialization tweaks)
- Request context edge cases (cleanup logic)
- Validation improvements (error messages)

**Tier 3: Moderate Implementations - 15 tests**
Features needing significant work:

- Writer functionality (2 tests - requires pubsub integration)
- Run count tracking (requires state management)
- Complex error handling (tripwire from processors)
- Nested workflow edge cases (path resolution)
- Foreach bail functionality (control flow)
- Conditional chains (execution logic)
- Status transitions (state machine)

**Tier 4: Complex/Out of Scope - 28 tests**
Features that are intentionally excluded or have architectural barriers:

- All restart tests (6 tests)
- All foreach concurrency tests (6 tests)
- Multiple parallel suspend tests (7 tests)
- Nested workflow resume edge cases (multiple tests)
- Tests marked as already skipped (remaining)

### Success Criteria

Phase 6 is complete when:

- All Tier 1 tests (quick wins) are implemented and passing
- At least 50% of Tier 2 tests are implemented and passing
- At least 25% of Tier 3 tests are implemented and passing
- All Tier 4 tests are documented as intentionally excluded
- Total passing tests in evented runtime: 190+ (up from 172)
- Test parity: >90% for equivalent functionality (excluding intentional differences)
