# Phase 2: Lifecycle Callbacks (onFinish/onError) - Research

**Researched:** 2026-01-27
**Domain:** Workflow lifecycle callbacks, event-driven error handling
**Confidence:** HIGH

## Summary

This phase ports 15 missing callback context tests from the default runtime to the evented runtime. The evented runtime already implements the core callback infrastructure - the `invokeLifecycleCallbacks` method in `ExecutionEngine` base class is shared between both runtimes. The evented runtime's `EventedExecutionEngine.execute()` already calls this method with most required context. The gap is primarily in what context is passed to the callbacks, particularly resourceId.

The evented tests already have 9 basic callback tests passing:
- onFinish when workflow succeeds
- onFinish when workflow fails
- onError when workflow fails
- onError not called when succeeds
- Both callbacks when fails
- Async onFinish
- onFinish with suspended status
- State in onFinish callback (Phase 1)
- State in onError callback (Phase 1)

What's missing are 15 tests verifying that specific context properties are correctly passed:
- mastra, logger, runId, workflowId, resourceId (for both onFinish and onError)
- requestContext, getInitData (for both)
- async onError callback

**Primary recommendation:** Port the 15 missing tests and fix any gaps in context propagation, primarily resourceId which appears to not be passed to `invokeLifecycleCallbacks`.

## Standard Stack

This phase uses existing infrastructure - no new libraries required.

### Core

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `ExecutionEngine` | `workflows/execution-engine.ts` | Base class with `invokeLifecycleCallbacks` | Shared implementation for both runtimes |
| `EventedExecutionEngine` | `workflows/evented/execution-engine.ts` | Evented-specific execution | Calls base class method |
| `WorkflowFinishCallbackResult` | `workflows/types.ts` | TypeScript interface for onFinish | Defines all expected properties |
| `WorkflowErrorCallbackInfo` | `workflows/types.ts` | TypeScript interface for onError | Defines all expected properties |

### Supporting

| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `RequestContext` | `request-context.ts` | DI context preservation | Passed through workflow execution |
| `IMastraLogger` | `logger/index.ts` | Logging interface | Available via `this.logger` in engine |
| `EventEmitterPubSub` | `events/pubsub/event-emitter.ts` | Test pubsub adapter | Required for evented tests |

## Architecture Patterns

### Callback Invocation Flow

```
EventedRun.start()
    |
    v
EventedExecutionEngine.execute()
    |
    +-- Publishes workflow.start event
    +-- Subscribes to workflows-finish
    +-- Waits for workflow.end/fail/suspend
    |
    v
invokeLifecycleCallbacks({
    status, result, error, steps, tripwire,
    runId, workflowId, resourceId,
    input, requestContext, state
})
    |
    v
options.onFinish(callbackResult)  // Always called
options.onError(errorInfo)        // Only on failure
```

### Callback Context Structure

```typescript
// Both callbacks receive:
{
  runId: string,              // Workflow run identifier
  workflowId: string,         // Workflow definition ID
  resourceId?: string,        // Optional user/tenant ID
  getInitData: () => any,     // Returns initial input
  mastra?: Mastra,            // Mastra instance if registered
  requestContext: RequestContext,
  logger: IMastraLogger,
  state: Record<string, any>, // Final workflow state
  status: WorkflowRunStatus,
  steps: Record<string, StepResult>,
  result?: any,               // onFinish only (success)
  error?: SerializedError,    // Both (failure)
  tripwire?: StepTripwireInfo // onError only
}
```

### Test Pattern for Evented Workflows

```typescript
it('should provide X in onFinish callback', async () => {
  let receivedX: Type | undefined;

  const step1 = createStep({...});

  const workflow = createWorkflow({
    id: 'test-X-onFinish-workflow',
    ...
    options: {
      onFinish: result => {
        receivedX = result.X;
      },
    },
  });
  workflow.then(step1).commit();

  // CRITICAL: Evented tests require Mastra with pubsub
  const mastra = new Mastra({
    workflows: { 'test-X-onFinish-workflow': workflow },
    storage: testStorage,
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startEventEngine();  // Start event processing

  const run = await workflow.createRun();
  await run.start({ inputData: {} });

  expect(receivedX).toBe(expectedValue);

  await mastra.stopEventEngine();  // Cleanup
});
```

### Anti-Patterns to Avoid

- **Missing mastra.startEventEngine():** Tests will timeout or fail silently
- **Missing mastra.stopEventEngine():** Tests may leak subscribers across test runs
- **Creating workflow without Mastra:** Callbacks may not receive mastra instance
- **Missing pubsub in Mastra config:** Evented workflows require pubsub adapter

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Callback invocation | Custom callback handling | `invokeLifecycleCallbacks` in base class | Shared implementation, error handling built in |
| Context building | Manual context assembly | Existing `commonContext` pattern in base class | Consistent with default runtime |
| Error serialization | Custom error handling | Existing error serialization utilities | Preserves error types across event boundaries |

## Common Pitfalls

### Pitfall 1: resourceId Not Propagated

**What goes wrong:** resourceId passed to `createRun({ resourceId })` doesn't appear in callbacks
**Why it happens:** The current `EventedExecutionEngine.execute()` passes `resourceId: undefined` to `invokeLifecycleCallbacks`
**How to avoid:** Pass `resourceId` from the run parameters through to the callback invocation
**Warning signs:** Test `should provide resourceId in onFinish/onError callback` fails

### Pitfall 2: requestContext Serialization

**What goes wrong:** requestContext is serialized to JSON for events but callbacks need RequestContext instance
**Why it happens:** Events pass serialized context, but callbacks expect the class instance
**How to avoid:** Rebuild RequestContext from serialized entries before calling callbacks
**Warning signs:** `requestContext.get()` throws or returns undefined

### Pitfall 3: Event Engine Lifecycle

**What goes wrong:** Tests timeout or produce flaky results
**Why it happens:** Missing `startEventEngine()` or `stopEventEngine()` calls
**How to avoid:** Every evented test must call both start and stop
**Warning signs:** Random test failures, hanging tests

### Pitfall 4: Mastra Instance Not Registered

**What goes wrong:** `result.mastra` is undefined in callbacks
**Why it happens:** Workflow not registered with Mastra via `workflows` config
**How to avoid:** Always use `new Mastra({ workflows: {...} })` pattern in tests
**Warning signs:** `expect(receivedMastra).toBe(mastra)` fails

## Code Examples

### Invoking Lifecycle Callbacks (from ExecutionEngine base class)

```typescript
// Source: packages/core/src/workflows/execution-engine.ts:73-134
public async invokeLifecycleCallbacks(result: {
  status: WorkflowRunStatus;
  result?: any;
  error?: any;
  steps: Record<string, StepResult<any, any, any, any>>;
  tripwire?: any;
  runId: string;
  workflowId: string;
  resourceId?: string;
  input?: any;
  requestContext: RequestContext;
  state: Record<string, any>;
}): Promise<void> {
  const { onFinish, onError } = this.options;

  // Build common context for callbacks
  const commonContext = {
    runId: result.runId,
    workflowId: result.workflowId,
    resourceId: result.resourceId,
    getInitData: () => result.input,
    mastra: this.mastra,
    requestContext: result.requestContext,
    logger: this.logger,
    state: result.state,
  };

  // Always call onFinish if defined
  if (onFinish) {
    try {
      await Promise.resolve(onFinish({
        status: result.status,
        result: result.result,
        error: result.error,
        steps: result.steps,
        tripwire: result.tripwire,
        ...commonContext,
      }));
    } catch (err) {
      this.logger.error('Error in onFinish callback', { error: err });
    }
  }

  // Call onError only for failure states
  if (onError && (result.status === 'failed' || result.status === 'tripwire')) {
    try {
      await Promise.resolve(onError({
        status: result.status as 'failed' | 'tripwire',
        error: result.error,
        steps: result.steps,
        tripwire: result.tripwire,
        ...commonContext,
      }));
    } catch (err) {
      this.logger.error('Error in onError callback', { error: err });
    }
  }
}
```

### Current Evented Engine Call (needs resourceId fix)

```typescript
// Source: packages/core/src/workflows/evented/execution-engine.ts:220-235
if (callbackArg.status !== 'paused') {
  await this.invokeLifecycleCallbacks({
    status: callbackArg.status,
    result: callbackArg.result,
    error: callbackArg.error,
    steps: callbackArg.steps,
    tripwire: undefined,
    runId: params.runId,
    workflowId: params.workflowId,
    resourceId: undefined,  // BUG: Should pass actual resourceId
    input: params.input,
    requestContext: params.requestContext,
    state: finalState,
  });
}
```

### Test Template for Context Property

```typescript
// Source: packages/core/src/workflows/workflow.test.ts (adapted for evented)
it('should provide [property] in onFinish callback', async () => {
  let received: PropertyType | undefined = undefined;

  const step1 = createStep({
    id: 'step1',
    execute: vi.fn().mockResolvedValue({ result: 'success' }),
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
  });

  const workflow = createWorkflow({
    id: 'test-[property]-onFinish-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    steps: [step1],
    options: {
      onFinish: result => {
        received = result.[property];
      },
    },
  });
  workflow.then(step1).commit();

  const mastra = new Mastra({
    workflows: { 'test-[property]-onFinish-workflow': workflow },
    storage: testStorage,
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startEventEngine();

  const run = await workflow.createRun();
  await run.start({ inputData: {} });

  expect(received).toBe(expected);

  await mastra.stopEventEngine();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Callbacks on default only | Callbacks shared via base class | Phase 2 work | Evented gets same callback behavior |

**Current implementation status:**
- Base `invokeLifecycleCallbacks` method exists and works
- Evented engine calls it with most context
- resourceId is not passed (needs fix)
- All other context properties should work

## Open Questions

1. **resourceId propagation path**
   - What we know: resourceId is stored on the Run object (`this.resourceId`)
   - What's unclear: How to pass it through the execution path to `invokeLifecycleCallbacks`
   - Recommendation: The execute params could include resourceId, or it could be obtained from storage

2. **Tripwire callback context**
   - What we know: `tripwire: undefined` is passed to invokeLifecycleCallbacks
   - What's unclear: Whether tripwire errors are handled in evented runtime
   - Recommendation: Review tripwire handling in Phase 3 or later

## Sources

### Primary (HIGH confidence)
- `packages/core/src/workflows/execution-engine.ts` - Base ExecutionEngine class with invokeLifecycleCallbacks
- `packages/core/src/workflows/evented/execution-engine.ts` - EventedExecutionEngine implementation
- `packages/core/src/workflows/types.ts` - WorkflowFinishCallbackResult and WorkflowErrorCallbackInfo interfaces
- `packages/core/src/workflows/workflow.test.ts` - Default runtime tests (specification)
- `packages/core/src/workflows/evented/evented-workflow.test.ts` - Existing evented tests

### Secondary (MEDIUM confidence)
- Codebase analysis of callback flow and context propagation

## Metadata

**Confidence breakdown:**
- Architecture understanding: HIGH - Direct code inspection
- Missing tests identification: HIGH - Grep comparison between test files
- Implementation approach: HIGH - Shared base class pattern already exists
- resourceId fix: MEDIUM - Clear bug but implementation path needs verification

**Research date:** 2026-01-27
**Valid until:** 60 days (stable internal API)

## Test Gap Analysis

### Already Passing in Evented (9 tests)
1. should call onFinish callback when workflow completes successfully
2. should call onFinish callback when workflow fails
3. should call onError callback when workflow fails
4. should not call onError callback when workflow succeeds
5. should call both onFinish and onError when workflow fails and both are defined
6. should support async onFinish callback
7. should call onFinish with suspended status when workflow suspends
8. should provide state in onFinish callback (Phase 1)
9. should provide state in onError callback (Phase 1)

### Missing Tests to Port (15 tests)
1. should provide mastra instance in onFinish callback
2. should provide mastra instance in onError callback
3. should provide logger in onFinish callback
4. should provide logger in onError callback
5. should provide runId in onFinish callback
6. should provide runId in onError callback
7. should provide workflowId in onFinish callback
8. should provide workflowId in onError callback
9. should provide resourceId in onFinish callback when provided
10. should provide resourceId in onError callback when provided
11. should provide requestContext in onFinish callback
12. should provide requestContext in onError callback
13. should provide getInitData function in onFinish callback
14. should provide getInitData function in onError callback
15. should support async onError callback

### Implementation Notes
- Tests 1-8, 11-15: Should pass with existing code (base class handles these)
- Tests 9-10 (resourceId): Require code fix - resourceId not currently passed to invokeLifecycleCallbacks
