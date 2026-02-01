# Engine Compatibility Plan

This document outlines how to align the Inngest Engine with the Default Engine behavior to make tests fully compatible.

---

## Executive Summary

There are **31 tests** currently skipped on Inngest due to behavioral differences. Achieving full compatibility requires changes at multiple layers:

| Category                | Tests | Effort | Impact                              |
| ----------------------- | ----- | ------ | ----------------------------------- |
| Validation Timing       | 3     | Low    | Prevents invalid workflow execution |
| `suspended` Array       | 3     | Medium | Enables auto-detect resume          |
| Status Values           | 1     | Medium | Consistent abort semantics          |
| Resume/Suspend          | 8     | High   | Full suspend/resume parity          |
| Nested Workflow Storage | 1     | Medium | Consistent step naming              |
| Restart                 | 4     | High   | New feature for Inngest             |
| Loop Counters           | 2     | Medium | Accurate retry/run counts           |
| Timing                  | 2     | N/A    | Inherent network overhead           |

---

## Category 1: Validation Timing (3 tests)

### Current Behavior

**Default Engine (`packages/core/src/workflows/workflow.ts:1796-1808`):**

```typescript
async createRun(options?: {...}): Promise<Run<...>> {
  if (this.stepFlow.length === 0) {
    throw new Error('Execution flow of workflow is not defined...');
  }
  if (!this.executionGraph.steps) {
    throw new Error('Uncommitted step flow changes detected...');
  }
  // ... rest of createRun
}
```

**Inngest Engine (`workflows/inngest/src/workflow.ts:110-176`):**

```typescript
async createRun(options?: {...}): Promise<Run<...>> {
  const runIdToUse = options?.runId || randomUUID();
  // NO validation checks - proceeds directly to create run
  // ...
}
```

### Root Cause

`InngestWorkflow.createRun()` overrides the parent without calling `super.createRun()` or replicating validation.

### Solution

**Option A: Call super.createRun() for validation (Recommended)**

```typescript
// In InngestWorkflow.createRun()
async createRun(options?: {...}): Promise<Run<...>> {
  // Call parent to get validation, then ignore the Run it creates
  // This is a workaround since we need InngestRun, not Run
  if (this.stepFlow.length === 0) {
    throw new Error('Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.');
  }
  if (!this.executionGraph.steps) {
    throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
  }
  // ... rest of current implementation
}
```

**Files to modify:**

- `workflows/inngest/src/workflow.ts` - Add validation checks at start of `createRun()`

**Tests enabled:**

- `executionFlowNotDefined`
- `executionGraphNotCommitted`

---

## Category 2: `suspended` Array in Result (3+ tests)

### Current Behavior

**Default Engine (`packages/core/src/workflows/default.ts:519-531`):**

```typescript
} else if (lastOutput.status === 'suspended') {
  const suspendPayload: Record<string, any> = {};
  const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
    if (stepResult?.status === 'suspended') {
      // ... build suspendPayload
      const nestedPath = __workflow_meta?.path;
      return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
    }
    return [];
  });
  base.suspended = suspendedStepIds;  // <-- This property is set
  // ...
}
```

**Inngest Engine:**
The `suspended` array is never populated in the result. The `workflow.ts` finalize step returns:

```typescript
{
  status: 'suspended',
  suspendPayload: ...,
  // NO `suspended` property
}
```

### Root Cause

Inngest's finalize step doesn't compute the `suspended` array from step results. The snapshot has `suspendedPaths` but this isn't converted to the `suspended` result property.

### Solution

In `workflow.ts` finalize step, after persisting snapshot, compute the `suspended` array:

```typescript
// In workflow.ts finalize step, after persisting snapshot
if (result.status === 'suspended') {
  // Build suspended array from step results
  const suspendedStepIds: string[][] = [];
  Object.entries(result.steps).forEach(([stepId, stepResult]) => {
    const res = stepResult as any;
    if (res?.status === 'suspended') {
      const nestedPath = res?.suspendPayload?.__workflow_meta?.path;
      if (nestedPath && Array.isArray(nestedPath)) {
        suspendedStepIds.push([stepId, ...nestedPath]);
      } else {
        suspendedStepIds.push([stepId]);
      }
    }
  });
  result.suspended = suspendedStepIds;
}
```

**Files to modify:**

- `workflows/inngest/src/workflow.ts` - Add `suspended` array computation in finalize step
- `workflows/inngest/src/run.ts` - Ensure `getRunOutput()` returns `suspended` from snapshot

**Tests enabled:**

- `resumeAutoDetect` - Uses `result.suspended[0]` to auto-detect resume target
- `resumeMultiSuspendError` - Checks `suspended.length > 1` for multi-suspend error

---

## Category 3: Abort Status (1 test)

### Current Behavior

**Default Engine (`packages/core/src/workflows/handlers/control-flow.ts:195-196`):**

```typescript
} else if (abortController?.signal?.aborted) {
  execResults = { status: 'canceled' };
}
```

**Inngest Engine:**
When `cancel.workflow.{id}` event is sent, Inngest's `cancelOn` mechanism terminates the function. The `getRunOutput()` polling sees status `'Cancelled'` from Inngest API:

```typescript
// In run.ts getRunOutput()
if (run?.status === 'Cancelled') {
  handleResult({ output: { result: { steps: snapshot?.context, status: 'canceled' } } }, 'polling-cancelled');
}
```

However, the `cancel()` method also persists with `status: 'canceled'`:

```typescript
// In run.ts cancel()
await workflowsStore?.persistWorkflowSnapshot({
  // ...
  snapshot: {
    ...snapshot,
    status: 'canceled' as any, // <-- This is set correctly
  },
});
```

### Root Cause

The issue is timing - when a workflow is cancelled, it may return `'failed'` instead of `'canceled'` depending on when the cancel event is processed. The Inngest function might throw a `NonRetriableError` on failure before the cancel is processed.

### Solution

**Option A: Check cancellation in finalize step before throwing failure**

```typescript
// In workflow.ts finalize step
if (result.status === 'failed') {
  // Check if this was actually a cancellation
  const wasCanceled = await this.checkCancellationStatus(runId);
  if (wasCanceled) {
    result = { ...result, status: 'canceled' };
    // Don't throw NonRetriableError for cancellation
    return result;
  }
  throw new NonRetriableError(...);
}
```

**Option B: Use Inngest's cancellation metadata**
The `cancelOn` trigger provides metadata that could be checked.

**Files to modify:**

- `workflows/inngest/src/workflow.ts` - Check cancellation before throwing in finalize
- `workflows/inngest/src/run.ts` - Ensure proper status mapping

**Tests enabled:**

- `abortStatus`

---

## Category 4: Resume/Suspend Coordination (8 tests)

### Current Behavior

The Default Engine maintains full execution state in memory and can resume at any point in complex control flow (foreach, nested workflows, loops). Inngest uses step memoization where each step's result is stored and replayed.

### Issues

1. **Foreach with suspend** - When an item in foreach suspends, Inngest's memoization doesn't track which iteration suspended
2. **Nested workflow resume** - The step path like `['parent-step', 'nested-step', 'leaf-step']` doesn't work with `step.invoke()`
3. **Loop resume** - doUntil/doWhile loops don't maintain loop iteration state across resume

### Root Cause

Inngest's execution model is fundamentally different:

- **Default Engine**: Single execution with in-memory state, suspend/resume is just state manipulation
- **Inngest Engine**: Each step is a durable function invocation, suspend/resume requires coordinating multiple function runs

### Solution

This requires significant architectural work:

**Phase 1: Foreach Index Tracking**

```typescript
// Track which foreach index suspended
if (isForeach && result.status === 'suspended') {
  result.suspendPayload.__foreach_index = currentIndex;
  snapshot.suspendedPaths[stepId] = {
    path: executionPath,
    foreachIndex: currentIndex,
  };
}
```

**Phase 2: Nested Path Resume**

```typescript
// In executeWorkflowStep, handle nested resume paths
if (resume?.steps?.length > 1) {
  // First step is the nested workflow, remaining steps are the nested path
  const nestedPath = resume.steps.slice(1);
  await step.invoke(..., { data: { resume: { steps: nestedPath, ... } } });
}
```

**Phase 3: Loop State Persistence**

```typescript
// Track loop iteration in snapshot
snapshot.loopState = {
  [stepId]: {
    iteration: currentIteration,
    condition: currentConditionResult,
  },
};
```

**Files to modify:**

- `workflows/inngest/src/execution-engine.ts` - Add foreach index, loop state tracking
- `workflows/inngest/src/workflow.ts` - Persist loop/foreach state in finalize
- `workflows/inngest/src/run.ts` - Resume with foreach index, nested path

**Tests enabled:**

- `resumeForeachLoop`
- `resumeForeachConcurrent`
- `resumeForeachIndex`
- `resumeNested`
- `resumeConsecutiveNested`
- `resumeDountil`
- `resumeLoopInput`
- `resumeMapStep`

**Effort: High** - Requires deep understanding of Inngest's execution model.

---

## Category 5: Nested Workflow Storage Naming (1 test)

### Current Behavior

**Default Engine:**
Step results stored with format: `workflow-id.step-id`

**Inngest Engine:**
Uses `step.invoke()` which stores with: `workflow.{parentWorkflowId}.step.{stepId}`

### Root Cause

Different step ID generation in `executeWorkflowStep()`:

```typescript
await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, ...)
```

### Solution

This is working as designed for Inngest. The test should accept either naming convention, or the shared test suite should normalize step names.

**Option A: Accept both formats in test assertions**
**Option B: Normalize step names in shared test utilities**

**Tests enabled:**

- `storageWithNestedWorkflows`

---

## Category 6: Restart (4 tests)

### Current Behavior

```typescript
// In packages/core/src/workflows/workflow.ts:3479-3481
async restart(...) {
  if (this.workflowEngineType !== 'default') {
    throw new Error(`restart() is not supported on ${this.workflowEngineType} workflows`);
  }
  // ...
}
```

### Root Cause

Restart requires re-executing from a snapshot while preserving the same runId. In Inngest:

1. The original function run has completed/failed
2. Sending a new event creates a NEW function run
3. There's no way to "restart" the same run

### Solution

**Option A: Implement restart as new run with state transfer**

```typescript
// In InngestRun.restart()
async restart({ inputData, initialState }) {
  // Load snapshot from original run
  const snapshot = await this.loadSnapshot();

  // Create new run with same runId prefix + restart suffix
  const restartRunId = `${this.runId}-restart-${Date.now()}`;

  // Send event with snapshot state
  await this.inngest.send({
    name: `workflow.${this.workflowId}`,
    data: {
      inputData: inputData ?? snapshot.input,
      initialState: initialState ?? snapshot.value,
      runId: restartRunId,
      isRestart: true,
      originalRunId: this.runId,
    }
  });
}
```

**Option B: Accept that restart is engine-specific**
Some engines support restart, others don't. Document and skip.

**Files to modify:**

- `workflows/inngest/src/run.ts` - Implement restart method

**Tests enabled:**

- `restartNotActive`
- `restartSuccess`
- `restartFailed`
- `restartSuspended`

---

## Category 7: Loop Counters (2 tests)

### Current Behavior

**Default Engine:**
Tracks `run.count` and `retry.count` in step execution context.

**Inngest Engine:**
Uses `inngestAttempts` from function context but doesn't expose the same counters.

### Root Cause

Inngest's retry handling is at the function level, not step level. The `executeStepWithRetry` handles retries manually but doesn't track the same way.

### Solution

```typescript
// In InngestExecutionEngine
async executeStepWithRetry(...) {
  for (let i = 0; i < params.retries + 1; i++) {
    // Expose retry count to step execution
    const result = await this.wrapDurableOperation(
      `${stepId}.attempt.${i}`,
      async () => {
        // Inject retry count into execution context
        executionContext.retryCount = i;
        return runStep();
      }
    );
    // ...
  }
}
```

**Files to modify:**

- `workflows/inngest/src/execution-engine.ts` - Track and expose retry/run counts

**Tests enabled:**

- `runCount`
- `retryCount`

---

## Category 8: Timing (2 tests) - SKIP

### Current Behavior

Inngest adds 100-500ms network overhead per step due to:

1. Event sending latency
2. Function invocation overhead
3. Step memoization persistence

### Solution

**These tests should remain skipped** - the timing difference is inherent to Inngest's distributed architecture.

The tests verify performance characteristics that don't apply to durable, distributed execution.

**Tests (remain skipped):**

- `foreachConcurrentTiming`
- `foreachPartialConcurrencyTiming`

---

## Category 9: Schema Validation (1 test)

### Current Behavior

**Default Engine:**
Schema validation throws synchronously when invalid data is passed.

**Inngest Engine:**
Validation happens but errors may be returned in result rather than thrown.

### Root Cause

The validation runs inside `step.run()` where thrown errors become failed step results rather than synchronous exceptions.

### Solution

Move validation before the Inngest event send:

```typescript
// In run.ts _start()
async _start(...) {
  // Validate BEFORE sending event
  const inputDataToUse = await this._validateInput(inputData);
  const initialStateToUse = await this._validateInitialState(initialState);

  // If validation throws, it throws here (synchronous from caller's perspective)

  // Now safe to send event
  const eventOutput = await this.inngest.send({...});
}
```

**Current code already does this** - the issue may be in how tests are structured. Need investigation.

**Tests enabled:**

- `schemaValidationThrows`

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)

1. **Validation in createRun** - 3 tests, copy-paste validation checks
2. **Schema validation timing** - 1 test, verify current implementation

### Phase 2: Medium Effort (3-5 days)

3. **`suspended` array** - 3 tests, add computation in finalize
4. **Abort status** - 1 test, check cancellation before throw
5. **Loop counters** - 2 tests, expose retry/run counts

### Phase 3: High Effort (1-2 weeks)

6. **Foreach index tracking** - 2 tests, state persistence changes
7. **Nested path resume** - 3 tests, step.invoke coordination
8. **Loop state persistence** - 2 tests, doUntil/doWhile state

### Phase 4: Consider Skipping

9. **Restart** - 4 tests, fundamental architecture difference
10. **Timing** - 2 tests, inherent network overhead

---

## Decision Matrix

| Fix                   | Tests | Effort | Risk   | Recommendation             |
| --------------------- | ----- | ------ | ------ | -------------------------- |
| Validation            | 3     | Low    | Low    | ✅ Do it                   |
| Schema validation     | 1     | Low    | Low    | ✅ Investigate first       |
| `suspended` array     | 3     | Medium | Low    | ✅ Do it                   |
| Abort status          | 1     | Medium | Medium | ✅ Do it                   |
| Loop counters         | 2     | Medium | Low    | ✅ Do it                   |
| Nested storage naming | 1     | Low    | Low    | ⚠️ Accept difference       |
| Foreach resume        | 2     | High   | Medium | ⚠️ Consider later          |
| Nested resume         | 3     | High   | High   | ⚠️ Consider later          |
| Loop resume           | 2     | High   | Medium | ⚠️ Consider later          |
| Restart               | 4     | High   | High   | ❌ Keep as engine-specific |
| Timing                | 2     | N/A    | N/A    | ❌ Keep skipped            |

---

## Summary

**Achievable with low-medium effort:** 10 tests
**Requires significant work:** 10 tests
**Should remain skipped:** 6 tests
**Accept as engine difference:** 5 tests

Total currently skipped: 31 tests
After Phase 1-2: ~21 tests could pass
After Phase 3: ~11 tests could pass
Permanent skips: 6 tests (timing + restart)
