# Phase 9: Foreach Index Resume - Research

**Researched:** 2026-01-27
**Domain:** Workflow foreach iteration control and resume targeting
**Confidence:** HIGH

## Summary

This phase implements targeted foreach iteration resume in the evented runtime by adding the `forEachIndex` parameter to `EventedRun.resume()`. This feature allows users to resume a specific suspended foreach iteration without re-executing completed iterations.

The default runtime already implements this feature through:
1. A `forEachIndex` parameter in `Run.resume()` that specifies which iteration to target
2. Metadata tracking in `__workflow_meta` that stores `foreachIndex`, `foreachOutput`, and `resumeLabels`
3. Control-flow logic that skips completed iterations and targets the specified index

The evented runtime needs to replicate this pattern by:
- Adding `forEachIndex` parameter to `EventedRun.resume()` signature
- Passing `forEachIndex` through to the execution engine
- Modifying foreach event processing to respect the targeted index
- Validating that `forEachIndex` is within the valid range (0 to array length - 1)

**Primary recommendation:** Port the default runtime's forEachIndex pattern to evented runtime, focusing on parameter propagation and index validation rather than complex iteration logic changes.

## Standard Stack

This is internal workflow runtime feature parity, not external library integration.

### Core Components
| Component | Location | Purpose | Pattern Used |
|-----------|----------|---------|--------------|
| Default Runtime Resume | `workflow.ts` lines 3253-3478 | Reference implementation | forEachIndex parameter, metadata storage |
| Default Control Flow | `handlers/control-flow.ts` lines 840-985 | Foreach iteration logic | Index tracking, skip completed iterations |
| Evented Runtime Resume | `evented/workflow.ts` lines 1622-1790 | Target for modification | Add forEachIndex parameter |
| Evented Foreach Processing | `evented/workflow-event-processor/loop.ts` lines 145-310 | Event-based iteration | Modify to respect forEachIndex |

### Metadata Schema
The `__workflow_meta` object structure used by default runtime:
```typescript
{
  foreachIndex: number,        // The currently suspended iteration index
  foreachOutput: StepResult[], // Array of iteration results so far
  resumeLabels: Record<string, { stepId: string, foreachIndex?: number }>,
  runId: string               // For nested workflows
}
```

## Architecture Patterns

### Pattern 1: Resume Parameter Threading
**What:** Pass forEachIndex from resume() call through execution layers
**When to use:** Any time a new resume parameter needs to reach execution handlers

**Flow:**
```typescript
EventedRun.resume({ forEachIndex: 2 })
  ↓
executionEngine.execute({ resume: { forEachIndex: 2, ... } })
  ↓
processWorkflowForEach() receives forEachIndex from resume context
  ↓
Iteration logic checks if this index should be resumed
```

**Example from default runtime:**
```typescript
// workflow.ts line 3451
resume: {
  steps,
  stepResults,
  resumePayload: resumeDataToUse,
  resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
  forEachIndex: params.forEachIndex ?? snapshotResumeLabel?.foreachIndex,  // ← Key line
  label: params.label,
}
```

### Pattern 2: Iteration Skip Logic
**What:** Skip completed iterations when forEachIndex is specified
**When to use:** In foreach processing, before executing an iteration

**Example from default runtime (control-flow.ts lines 859-873):**
```typescript
const prevItemResult = prevForeachOutput[k];
if (
  prevItemResult?.status === 'success' ||
  (prevItemResult?.status === 'suspended' && resume?.forEachIndex !== k && resume?.forEachIndex !== undefined)
) {
  return prevItemResult;  // Skip this iteration
}
let resumeToUse = undefined;
if (resume?.forEachIndex !== undefined) {
  resumeToUse = resume.forEachIndex === k ? resume : undefined;
} else {
  const isIndexSuspended = prevItemResult?.status === 'suspended' || resumeIndex === k;
  if (isIndexSuspended) {
    resumeToUse = resume;
  }
}
```

**Key insight:** When `forEachIndex` is specified, only that specific index gets resume data. All other iterations are skipped if completed or remain suspended.

### Pattern 3: Metadata Preservation on Suspend
**What:** Store foreach state in `__workflow_meta` when iteration suspends
**When to use:** When a foreach iteration suspends, before returning result

**Example from default runtime (control-flow.ts lines 979-984):**
```typescript
suspendPayload: {
  ...foreachIndexObj[foreachIndex].suspendPayload,
  __workflow_meta: {
    ...foreachIndexObj[foreachIndex].suspendPayload?.__workflow_meta,
    foreachIndex,
    foreachOutput: prevForeachOutput,
    resumeLabels: executionContext.resumeLabels,
  },
}
```

### Anti-Patterns to Avoid
- **Don't validate forEachIndex in EventedRun.resume()**: The validation should happen in the foreach processor where array length is known
- **Don't modify existing resume without forEachIndex behavior**: The new parameter should be optional and backward-compatible
- **Don't expose __workflow_meta to user code**: This metadata is internal workflow state, filter it out before passing to step execute functions (see step.ts lines 119-122)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parameter threading | Custom context passing | Existing resume object structure | Default runtime already has the pattern, just add the field |
| Index validation | Custom range checks | Array bounds check against foreachOutput.length | Simple and matches what default runtime would do |
| Metadata filtering | Custom object filtering | Destructuring pattern `{ __workflow_meta, ...userSuspendData }` | Already used in step.ts lines 119-122 |

**Key insight:** This is a straightforward parameter addition, not a new architecture. Follow the exact pattern used by default runtime to ensure parity.

## Common Pitfalls

### Pitfall 1: Missing forEachIndex Validation
**What goes wrong:** Resume with invalid forEachIndex (negative, >= array length) silently fails or causes runtime errors
**Why it happens:** No validation between resume() call and iteration execution
**How to avoid:** Add range validation in processWorkflowForEach before processing iterations:
```typescript
if (resume?.forEachIndex !== undefined) {
  const targetLen = prevResult?.output?.length ?? 0;
  if (resume.forEachIndex < 0 || resume.forEachIndex >= targetLen) {
    throw new Error(`forEachIndex ${resume.forEachIndex} out of range [0, ${targetLen - 1}]`);
  }
}
```
**Warning signs:** Tests failing with array access errors, iterations being skipped unexpectedly

### Pitfall 2: forEachIndex Not Passed Through Resume Chain
**What goes wrong:** forEachIndex specified in resume() but doesn't reach foreach processor
**Why it happens:** Missing parameter in intermediate execution calls
**How to avoid:** Trace the call chain:
1. EventedRun.resume() receives `forEachIndex`
2. executionEngine.execute() includes it in `resume` object
3. WorkflowEventProcessor passes it in ProcessorArgs
4. processWorkflowForEach accesses it from resume parameter

Verify each step passes the parameter through.

**Warning signs:** forEachIndex has no effect, all iterations resume instead of targeted one

### Pitfall 3: Resume Labels vs forEachIndex Precedence
**What goes wrong:** Both label and forEachIndex specified, unclear which takes precedence
**Why it happens:** Two different targeting mechanisms
**How to avoid:** Follow default runtime pattern (workflow.ts line 3451):
```typescript
forEachIndex: params.forEachIndex ?? snapshotResumeLabel?.foreachIndex
```
Explicit forEachIndex parameter takes precedence over label-derived forEachIndex.

**Warning signs:** Resume targeting wrong iteration when both label and forEachIndex provided

### Pitfall 4: Confusing foreachIndex (metadata) vs forEachIndex (parameter)
**What goes wrong:** Using wrong casing or mixing up the metadata field with the parameter
**Why it happens:** Similar names with different casing
**How to avoid:**
- `foreachIndex` (lowercase 'e'): stored in `__workflow_meta`, tracks which iteration is suspended
- `forEachIndex` (uppercase 'E'): parameter in resume() call, specifies which iteration to resume
- `foreachIndex` in ExecutionContext: runtime tracking of current iteration

Keep them distinct in code and comments.

**Warning signs:** TypeScript errors about property not existing, runtime undefined access

## Code Examples

### Adding forEachIndex to EventedRun.resume()

```typescript
// Source: evented/workflow.ts lines 1622-1635 (current implementation)
// Modification needed: Add forEachIndex parameter

async resume<TResumeSchema>(params: {
  resumeData?: TResumeSchema;
  step?:
    | Step<string, any, any, TResumeSchema, any, any, TEngineType>
    | [
        ...Step<string, any, any, any, any, any, TEngineType>[],
        Step<string, any, any, TResumeSchema, any, any, TEngineType>,
      ]
    | string
    | string[];
  label?: string;
  requestContext?: RequestContext;
  perStep?: boolean;
  forEachIndex?: number;  // ← Add this parameter
}): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>
```

### Passing forEachIndex to Execution Engine

```typescript
// Source: evented/workflow.ts lines 1760-1778 (current implementation)
// Modification needed: Add forEachIndex to resume object

const executionResultPromise = this.executionEngine
  .execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
    workflowId: this.workflowId,
    runId: this.runId,
    graph: this.executionGraph,
    serializedStepGraph: this.serializedStepGraph,
    input: snapshot?.context?.input as TInput,
    initialState: resumeState as TState,
    resume: {
      steps,
      stepResults: snapshot?.context as any,
      resumePayload: resumeDataToUse,
      resumePath,
      forEachIndex: params.forEachIndex,  // ← Add this field
    },
    pubsub: this.mastra.pubsub,
    requestContext,
    abortController: this.abortController,
    perStep: params.perStep,
  })
```

### Index Validation in processWorkflowForEach

```typescript
// Source: New code to add to evented/workflow-event-processor/loop.ts
// Location: processWorkflowForEach, after extracting prevResult and before iteration logic

export async function processWorkflowForEach(
  {
    workflowId,
    prevResult,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resumeSteps,
    resumeData,
    parentWorkflow,
    requestContext,
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    mastra,
    step,
  }: {
    pubsub: PubSub;
    mastra: Mastra;
    step: Extract<StepFlowEntry, { type: 'foreach' }>;
  },
) {
  // ... existing code to extract currentState, currentResult, idx, targetLen ...

  // NEW: Validate forEachIndex if provided via resumeSteps
  const resume = resumeSteps?.[0] === step.step.id ? /* extract resume from context */ : undefined;
  if (resume?.forEachIndex !== undefined) {
    const targetLen = prevResult?.output?.length ?? 0;
    if (resume.forEachIndex < 0 || resume.forEachIndex >= targetLen) {
      throw new Error(
        `forEachIndex ${resume.forEachIndex} is out of range. Valid range: [0, ${targetLen - 1}]`
      );
    }
  }

  // ... rest of existing logic ...
}
```

### Skipping Non-Targeted Iterations

```typescript
// Source: Pattern from default runtime control-flow.ts lines 859-873
// Apply this logic in evented foreach processing when determining which iteration to execute

// Check if we should skip this iteration
const shouldSkipIteration = (iterationIndex: number): boolean => {
  if (!resume?.forEachIndex !== undefined) {
    // No targeted resume, proceed normally
    return false;
  }

  if (resume.forEachIndex !== iterationIndex) {
    // This is not the targeted iteration
    const prevIterationResult = currentResult?.output?.[iterationIndex];
    // Skip if already completed or suspended (we're targeting a different index)
    return prevIterationResult?.status === 'success' ||
           prevIterationResult?.status === 'suspended';
  }

  // This is the targeted iteration, don't skip
  return false;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resume all suspended iterations | Resume specific iteration via forEachIndex | Default runtime already has this | Evented runtime needs parity |
| Manual iteration tracking | Automatic foreachIndex in ExecutionContext | Existing in both runtimes | No change needed |
| No resume labels | Resume labels with foreachIndex | Already in default runtime | Evented runtime already supports labels |

**Deprecated/outdated:**
None - this is a new feature addition, not replacing old behavior.

## Open Questions

None - the default runtime implementation provides a complete reference.

## Sources

### Primary (HIGH confidence)
- `/packages/core/src/workflows/workflow.ts` lines 3253-3478 - Default runtime resume() implementation showing forEachIndex parameter and usage
- `/packages/core/src/workflows/handlers/control-flow.ts` lines 840-985 - Foreach iteration logic with forEachIndex handling
- `/packages/core/src/workflows/types.ts` lines 843-848 - RegularStepExecutionParams showing forEachIndex in resume object
- `/packages/core/src/workflows/evented/workflow.ts` lines 1622-1790 - Evented runtime resume() method (target for modification)
- `/packages/core/src/workflows/evented/workflow-event-processor/loop.ts` lines 145-310 - Evented foreach processing (target for modification)

### Secondary (MEDIUM confidence)
- `/packages/core/src/workflows/evented/evented-workflow.test.ts` lines 18910-19269 - Skipped tests documenting expected behavior

### Tertiary (LOW confidence)
None - all research based on existing codebase.

## Metadata

**Confidence breakdown:**
- Parameter signature: HIGH - Exact pattern visible in default runtime
- Threading through execution: HIGH - Call chain is clear and simple
- Validation requirements: HIGH - Success criteria explicitly state range validation
- Iteration skip logic: MEDIUM - Evented runtime uses different iteration model, may need adaptation

**Research date:** 2026-01-27
**Valid until:** 90 days (stable internal API, no external dependencies)
