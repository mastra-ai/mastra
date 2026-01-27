# Phase 4: Suspend/Resume Edge Cases - Research

**Researched:** 2026-01-27
**Domain:** Workflow suspend/resume mechanisms
**Confidence:** HIGH

## Summary

Phase 4 addresses the remaining gaps in suspend/resume functionality between the default and evented workflow runtimes. The evented runtime already handles basic suspend/resume scenarios but lacks several edge cases including:

1. **Resume labels** - Ability to resume by label instead of step path
2. **Auto-resume** - Automatic detection of single suspended step
3. **Parallel suspend handling** - Proper management of multiple suspended steps in parallel/branch workflows
4. **Foreach suspend/resume** - Suspend/resume within foreach loops including index-based resume
5. **Nested workflow suspend context** - Preserving context across nested workflow suspensions

The evented implementation shares the same core `Step` abstraction and uses a similar suspend mechanism (via `suspendPayload` with `__workflow_meta`), but the `EventedRun.resume()` method lacks several features present in the default `Run.resume()` method.

**Primary recommendation:** Port the 24 suspend/resume tests in phases - starting with simple features (auto-resume, error cases), then medium complexity (labels, suspendData access), then complex (foreach, nested workflows).

## Test Inventory

### Default Runtime Reference Tests (packages/core/src/workflows/workflow.test.ts)

| Test | Line | Category | Complexity |
|------|------|----------|------------|
| should handle basic suspend and resume flow that does not close on suspend | 1920 | Stream Options | Simple |
| should handle basic suspend and resume flow using resumeLabel | 314 | Resume Label | Medium |
| should auto-resume simple suspended step without specifying step parameter | 16367 | Auto-Resume | Simple |
| should throw error when multiple steps are suspended and no step specified | 16434 | Auto-Resume | Simple |
| should throw error when you try to resume a workflow that is not suspended | 12099 | Error Handling | Simple |
| should throw error when you try to resume a workflow step that is not suspended | 12152 | Error Handling | Simple |
| should support both explicit step resume and auto-resume (backwards compatibility) | 12232 | Auto-Resume | Simple |
| should remain suspended when only one of multiple parallel suspended steps is resumed | 20013 | Parallel | Medium |
| should handle multiple suspend/resume cycles in parallel workflow | 20134 | Parallel | Medium |
| should provide access to suspendData in workflow step on resume | 20229 | SuspendData | Medium |
| should handle missing suspendData gracefully | 20311 | SuspendData | Simple |
| should handle consecutive nested workflows with suspend/resume | 18494 | Nested | Complex |
| should be able to resume suspended nested workflow step with only nested workflow step provided | 18367 | Nested | Complex |
| should not execute incorrect branches after resuming from suspended nested workflow | 19003 | Nested/Branch | Complex |
| should maintain correct step status after resuming in branching workflows | 19190 | Branch | Medium |
| should have access to the correct input value when resuming in a loop | 12306 | DoUntil | Complex |
| should handle basic suspend and resume in nested dountil workflow | 12002 | Nested/DoUntil | Complex |
| should preserve input property from snapshot context after resume | 1367 | Context | Medium |
| should preserve request context in nested workflows after suspend/resume | 18599 | Nested/Context | Complex |
| should have access to requestContext from before suspension during workflow resume | 19608 | Context | Medium |
| should suspend and resume when running a single item concurrency (default) for loop | 7678 | Foreach | Complex |
| should suspend and resume when running all items concurrency for loop | 7844 | Foreach | Complex |
| should suspend and resume provided index when running all items concurrency for loop | 7930 | Foreach | Complex |
| should suspend and resume provided label when running all items concurrency for loop | 8057 | Foreach | Complex |
| should suspend and resume when running a partial item concurrency for loop | 8223 | Foreach | Complex |
| should suspend and resume provided index when running a partial item concurrency for loop | 8314 | Foreach | Complex |

**Total: 26 tests** (24 unique + 2 variations)

### Existing Evented Tests (packages/core/src/workflows/evented/evented-workflow.test.ts)

| Test | Line | Notes |
|------|------|-------|
| should handle basic suspend and resume flow | 171, 1063 | Duplicated - basic functionality works |
| should handle basic suspend and resume flow with async await syntax | 7081 | Works |
| should handle basic suspend and resume single step flow with async await syntax and perStep:true | 7334 | Works |
| should handle basic suspend and resume in a dountil workflow | 7643 | Basic doUntil works |
| should successfully suspend and resume a timeTravelled workflow execution | 9023 | TimeTravel + suspend works |
| should be able to suspend nested workflow step | 12051 | Basic nested suspend works |
| should inject requestContext dependencies into steps during resume | 12786 | Basic context works |
| should preserve state across suspend and resume cycles | 14324 | State + suspend works |
| should handle basic suspend and resume flow with async await syntax with state | 14801 | State + suspend works |

**Notable skipped tests in evented:**
- should throw error when you try to resume a workflow step with invalid resume data (Phase 4) - line 6059
- should use default value from resumeSchema when resuming a workflow (Phase 4) - line 6145

## Architecture Patterns

### Current Evented Resume Implementation

The evented `EventedRun.resume()` method (workflow.ts lines 1324-1432):

```typescript
async resume<TResumeSchema>(params: {
  resumeData?: TResumeSchema;
  step:                          // REQUIRED - no auto-detection
    | Step<...>
    | [...Step[], Step<...>]
    | string
    | string[];
  requestContext?: RequestContext;
  perStep?: boolean;
}): Promise<WorkflowResult<...>>
```

**Missing features compared to default:**
1. No `label?: string` parameter for resume labels
2. `step` is required (no auto-resume from suspendedPaths)
3. No `forEachIndex?: number` parameter
4. No auto-detection of single suspended step

### Default Runtime Resume Features

The default `Run.resume()` method (workflow.ts lines 3253-3399):

```typescript
async resume<TResume>(params: {
  resumeData?: TResume;
  step?:                         // OPTIONAL - auto-detects
    | Step<...>
    | [...Step[], Step<...>]
    | string
    | string[];
  label?: string;                // Resume by label
  requestContext?: RequestContext;
  forEachIndex?: number;         // Foreach-specific resume
  perStep?: boolean;
}): Promise<WorkflowResult<...>>
```

**Key logic differences:**

1. **Resume Label Resolution** (line 3333):
   ```typescript
   const snapshotResumeLabel = params.label ? snapshot?.resumeLabels?.[params.label] : undefined;
   const stepParam = snapshotResumeLabel?.stepId ?? params.step;
   ```

2. **Auto-Resume Detection** (lines 3346-3381):
   ```typescript
   // Use suspendedPaths to detect suspended steps
   const suspendedStepPaths: string[][] = [];
   // ... builds list from snapshot.suspendedPaths

   if (suspendedStepPaths.length === 1) {
     steps = suspendedStepPaths[0]!;
   } else {
     throw new Error(`Multiple suspended steps found: ...`);
   }
   ```

3. **Step Validation** (lines 3384-3394):
   ```typescript
   if (!isStepSuspended) {
     throw new Error(
       `This workflow step "${steps?.[0]}" was not suspended. ` +
       `Available suspended steps: [${suspendedStepIds.join(', ')}]`
     );
   }
   ```

### SuspendData Access Pattern

The step executor provides `suspendData` to the execute function (step-executor.ts lines 79-87):

```typescript
// Extract suspend data if this step was previously suspended
let suspendDataToUse =
  params.stepResults[step.id]?.status === 'suspended'
    ? params.stepResults[step.id]?.suspendPayload
    : undefined;

// Filter out internal workflow metadata before exposing to step code
if (suspendDataToUse && '__workflow_meta' in suspendDataToUse) {
  const { __workflow_meta, ...userSuspendData } = suspendDataToUse;
  suspendDataToUse = userSuspendData;
}
```

This is passed to the step execute function:
```typescript
suspendData: suspendDataToUse,  // line 109
```

**Evented runtime already implements this** - verified in step-executor.ts.

### Resume Label Storage

The default runtime stores resume labels in the snapshot:

```typescript
interface WorkflowRunState {
  // ...
  resumeLabels: Record<string, { stepId: string }>;
  // ...
}
```

The `suspend()` function accepts options:
```typescript
await suspend(payload, { resumeLabel: 'my-label' });
```

**Evented runtime initializes `resumeLabels: {}` but never populates it.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-resume detection | Custom snapshot parsing | Copy default runtime's logic | Edge cases with nested workflows |
| Suspend path tracking | Manual path construction | `__workflow_meta.path` pattern | Already established convention |
| Multiple suspended step detection | Simple array length check | Full suspendedPaths analysis | Nested paths need proper handling |
| Error messages | Generic messages | Copy default runtime's format | User-facing consistency |

## Common Pitfalls

### Pitfall 1: Incomplete Nested Workflow Path Handling

**What goes wrong:** Resume with nested path like `['sub-workflow', 'step-1']` fails to properly resolve nested workflow runId.

**Why it happens:** The evented runtime stores nested workflow info in `suspendPayload.__workflow_meta` but the path resolution differs from default.

**How to avoid:** Follow the default runtime's pattern for extracting nested runId from step result:
```typescript
const stepData = stepResults[step.step.id];
const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
```

**Warning signs:** Resume succeeds but nested workflow doesn't re-execute.

### Pitfall 2: Parallel Suspend Path Merging

**What goes wrong:** When multiple parallel steps suspend, resuming one clears the other's suspended status.

**Why it happens:** The workflow-event-processor updates snapshot status without preserving other suspended paths.

**How to avoid:** The default runtime tracks individual step suspension status and only marks workflow complete when ALL parallel paths complete.

**Warning signs:** `result.suspended` array shows fewer items than expected after partial resume.

### Pitfall 3: Foreach Index Resume Mismatch

**What goes wrong:** Resuming with `forEachIndex` doesn't resume the correct iteration.

**Why it happens:** Foreach suspend/resume requires tracking which iterations suspended, not just that the foreach step suspended.

**How to avoid:** The evented runtime needs to track `suspendedIterations` separately from step-level suspension.

**Warning signs:** Resume data gets applied to wrong foreach iteration.

### Pitfall 4: Request Context Loss on Resume

**What goes wrong:** Request context values set before suspend are not available after resume.

**Why it happens:** Context not properly serialized to snapshot or not restored on resume.

**How to avoid:** The evented runtime's resume method already handles this (lines 1374-1387):
```typescript
// First, set values from the snapshot
for (const [key, value] of Object.entries(requestContextObj)) {
  requestContext.set(key, value);
}
// Then, override with any values from the passed request context
if (params.requestContext) {
  for (const [key, value] of params.requestContext.entries()) {
    requestContext.set(key, value);
  }
}
```

**Warning signs:** `requestContext.get()` returns undefined for values set before suspend.

## Gap Analysis

### Features Missing in Evented Runtime

| Feature | Default Has | Evented Has | Implementation Effort |
|---------|-------------|-------------|----------------------|
| Auto-resume (single suspended) | Yes | No | Low - add logic to resume() |
| Resume by label | Yes | No | Medium - store labels in suspend |
| Error: workflow not suspended | Yes | No | Low - add check |
| Error: step not suspended | Yes | No | Low - add check |
| Error: multiple suspended, no step | Yes | No | Low - add check |
| forEachIndex parameter | Yes | No | High - foreach state tracking |
| suspendData access | Yes | Yes | None - already works |
| closeOnSuspend: false | Yes | Partial | Low - verify behavior |

### Test Categories by Implementation Order

**Phase 4a: Simple Error Cases & Auto-Resume (6 tests)**
- should throw error when you try to resume a workflow that is not suspended
- should throw error when you try to resume a workflow step that is not suspended
- should auto-resume simple suspended step without specifying step parameter
- should throw error when multiple steps are suspended and no step specified
- should support both explicit step resume and auto-resume (backwards compatibility)
- should handle missing suspendData gracefully

**Phase 4b: Resume Labels & SuspendData (4 tests)**
- should handle basic suspend and resume flow using resumeLabel
- should provide access to suspendData in workflow step on resume
- should handle basic suspend and resume flow that does not close on suspend
- should preserve input property from snapshot context after resume

**Phase 4c: Parallel/Branch Suspend (4 tests)**
- should remain suspended when only one of multiple parallel suspended steps is resumed
- should handle multiple suspend/resume cycles in parallel workflow
- should maintain correct step status after resuming in branching workflows
- should not execute incorrect branches after resuming from suspended nested workflow

**Phase 4d: Context Preservation (2 tests)**
- should preserve request context in nested workflows after suspend/resume
- should have access to requestContext from before suspension during workflow resume

**Phase 4e: Nested Workflow Edge Cases (4 tests)**
- should handle consecutive nested workflows with suspend/resume
- should be able to resume suspended nested workflow step with only nested workflow step provided
- should have access to the correct input value when resuming in a loop
- should handle basic suspend and resume in nested dountil workflow

**Phase 4f: Foreach Suspend/Resume (6 tests)**
- should suspend and resume when running a single item concurrency (default) for loop
- should suspend and resume when running all items concurrency for loop
- should suspend and resume provided index when running all items concurrency for loop
- should suspend and resume provided label when running all items concurrency for loop
- should suspend and resume when running a partial item concurrency for loop
- should suspend and resume provided index when running a partial item concurrency for loop

## Code Examples

### Auto-Resume Implementation Pattern

From default runtime (workflow.ts lines 3346-3381):

```typescript
// Auto-detect suspended steps if no step is provided
let steps: string[];
if (stepParam) {
  // ... existing step param handling
} else {
  // Use suspendedPaths to detect suspended steps
  const suspendedStepPaths: string[][] = [];

  Object.entries(snapshot?.suspendedPaths ?? {}).forEach(([stepId, _executionPath]) => {
    const stepResult = snapshot?.context?.[stepId];
    if (stepResult && typeof stepResult === 'object' && 'status' in stepResult) {
      const stepRes = stepResult as any;
      if (stepRes.status === 'suspended') {
        const nestedPath = stepRes.suspendPayload?.__workflow_meta?.path;
        if (nestedPath && Array.isArray(nestedPath)) {
          suspendedStepPaths.push([stepId, ...nestedPath]);
        } else {
          suspendedStepPaths.push([stepId]);
        }
      }
    }
  });

  if (suspendedStepPaths.length === 0) {
    throw new Error('No suspended steps found in this workflow run');
  }

  if (suspendedStepPaths.length === 1) {
    steps = suspendedStepPaths[0]!;
  } else {
    const pathStrings = suspendedStepPaths.map(path => `[${path.join(', ')}]`);
    throw new Error(
      `Multiple suspended steps found: ${pathStrings.join(', ')}. ` +
      'Please specify which step to resume using the "step" parameter.',
    );
  }
}
```

### Workflow Suspended Check Pattern

From default runtime (workflow.ts lines 3329-3331):

```typescript
if (snapshot.status !== 'suspended') {
  throw new Error('This workflow run was not suspended');
}
```

### Step Not Suspended Check Pattern

From default runtime (workflow.ts lines 3384-3394):

```typescript
if (!params.retryCount) {
  const suspendedStepIds = Object.keys(snapshot?.suspendedPaths ?? {});
  const isStepSuspended = suspendedStepIds.includes(steps?.[0] ?? '');

  if (!isStepSuspended) {
    throw new Error(
      `This workflow step "${steps?.[0]}" was not suspended. ` +
      `Available suspended steps: [${suspendedStepIds.join(', ')}]`,
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Required step param | Auto-resume single | Recent | UX improvement |
| No label support | Resume by label | Recent | Workflow flexibility |
| Basic suspend | suspendData access | Recent | Step can access own suspend payload |

## Open Questions

1. **Foreach suspend state format**
   - What we know: Default tracks suspended iterations
   - What's unclear: Exact format in evented snapshot
   - Recommendation: Analyze default foreach handler before implementing

2. **Resume label persistence**
   - What we know: Default stores in `snapshot.resumeLabels`
   - What's unclear: How evented suspend captures label option
   - Recommendation: Add label capture in step-executor suspend handler

3. **Parallel branch merging after partial resume**
   - What we know: Default maintains individual step statuses
   - What's unclear: How evented processWorkflowParallel handles partial completion
   - Recommendation: Study workflow-event-processor/parallel.ts

## Sources

### Primary (HIGH confidence)
- packages/core/src/workflows/workflow.ts - Default runtime implementation
- packages/core/src/workflows/workflow.test.ts - Default runtime tests
- packages/core/src/workflows/evented/workflow.ts - Evented runtime implementation
- packages/core/src/workflows/evented/evented-workflow.test.ts - Evented runtime tests
- packages/core/src/workflows/evented/step-executor.ts - Step execution logic
- packages/core/src/workflows/evented/execution-engine.ts - Execution orchestration
- packages/core/src/workflows/evented/workflow-event-processor/index.ts - Event processing

### Secondary (MEDIUM confidence)
- ROADMAP.md - Phase planning context

## Metadata

**Confidence breakdown:**
- Test inventory: HIGH - Direct line number references verified
- Gap analysis: HIGH - Direct code comparison performed
- Implementation approach: HIGH - Based on existing patterns

**Research date:** 2026-01-27
**Valid until:** 30 days (stable domain)
