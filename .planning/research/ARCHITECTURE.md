# Architecture Integration: v1.1 Agent Integration Features

**Domain:** Evented workflow runtime agent integration
**Researched:** 2026-01-27
**Milestone:** v1.1 Agent Integration

## Executive Summary

Four features integrate with the existing evented workflow architecture to enable full agent step parity:

1. **V2 Model Support**: Replace `streamLegacy()` with `stream()` in agent step execution
2. **TripWire Propagation**: Surface TripWire errors from agents as workflow step failures with metadata
3. **Writer API Exposure**: Wire ToolStream writer through step context for streaming output
4. **Foreach Index Resume**: Pass `forEachIndex` from resume labels to step executor

All features are **additive modifications** to existing components—no architectural refactoring required. The evented runtime's event-driven, distributed architecture remains intact.

## Current Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    WorkflowEventProcessor                       │
│                   (State Machine Orchestrator)                  │
│                                                                 │
│  - processWorkflowStepRun() → routes events to handlers        │
│  - processWorkflowStepEnd() → aggregates results               │
│  - Maintains abortControllers Map for cancellation             │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ├─────────────> StepExecutor
            │                - execute() → runs individual steps
            │                - Builds step context with params
            │                - Currently: writer: undefined
            │
            ├─────────────> Handlers (loop.ts, parallel.ts)
            │                - processWorkflowForEach()
            │                - processWorkflowLoop()
            │                - processWorkflowParallel()
            │                - processWorkflowConditional()
            │
            └─────────────> EventedExecutionEngine
                             - execute() → entry point
                             - invokeLifecycleCallbacks()
                             - Subscribes to 'workflows-finish' events
```

### Data Flow: Step Execution

```
1. WorkflowEventProcessor.processWorkflowStepRun()
   ↓
2. StepExecutor.execute({
     step,
     stepResults,
     state,
     foreachIdx,        ← Already exists for item extraction
     abortController,   ← Already exists for cancellation
     emitter,
     requestContext
   })
   ↓
3. step.execute(context) where context = {
     inputData,
     state,
     setState,
     mastra,
     requestContext,
     writer: undefined,  ← TODO: Wire from outputWriter
     abortSignal,
     getStepResult,
     suspend,
     bail,
     ...
   }
   ↓
4. Return StepResult {
     status: 'success' | 'failed' | 'suspended',
     output,
     error,             ← TODO: Extract TripWire from error
     __state
   }
   ↓
5. WorkflowEventProcessor.processWorkflowStepEnd()
   ↓
6. EventedExecutionEngine.invokeLifecycleCallbacks()
```

## Feature Integration Points

### Feature 1: V2 Model Support

**Current limitation:**
```typescript
// step-executor.ts line 94
const stepOutput = await step.execute(context);
```

Agent steps internally call:
```typescript
// agent-legacy.ts
if (llm.getModel().specificationVersion !== 'v1') {
  throw new MastraError({
    text: 'V2 models are not supported for streamLegacy. Please use stream instead.'
  });
}
```

**Integration approach:**

Agent steps detect model version and call appropriate method. No workflow-side changes needed—agent handles this internally.

**Files modified:**
- `packages/core/src/agent/agent-legacy.ts` (agent implementation)

**Data flow unchanged.** Step executor continues calling `step.execute()`. Agent step's execute function chooses `stream()` vs `streamLegacy()` based on model spec version.

---

### Feature 2: TripWire Propagation

**Current state:**

TripWire exists in agent layer but doesn't propagate to workflow:
```typescript
// agent/trip-wire.ts
export class TripWire<TMetadata = unknown> extends Error {
  public readonly options: TripWireOptions<TMetadata>;
  public readonly processorId?: string;
}

// workflows/types.ts (already defined!)
export interface StepTripwireInfo {
  reason: string;
  retry?: boolean;
  metadata?: Record<string, unknown>;
  processorId?: string;
}

export type StepFailure = {
  status: 'failed';
  error: Error;
  tripwire?: StepTripwireInfo;  ← Field exists but unused
  ...
}
```

**Integration approach:**

When agent throws TripWire, step executor catches it and populates `stepResult.tripwire`:

```typescript
// step-executor.ts execute() catch block (line 213)
catch (error: any) {
  const errorInstance = getErrorFromUnknown(error);

  // NEW: Check if error is TripWire
  let tripwireInfo: StepTripwireInfo | undefined;
  if (error instanceof TripWire) {
    tripwireInfo = {
      reason: error.message,
      retry: error.options.retry,
      metadata: error.options.metadata,
      processorId: error.processorId,
    };
  }

  return {
    ...stepInfo,
    status: 'failed',
    endedAt,
    error: errorInstance,
    tripwire: tripwireInfo,  ← Add tripwire field
  };
}
```

**Files modified:**
1. `packages/core/src/workflows/evented/step-executor.ts` - Add TripWire detection in catch block
2. `packages/core/src/workflows/evented/execution-engine.ts` - Extract tripwire from stepResults and pass to callbacks

**Data flow changes:**

```
Agent throws TripWire
  ↓
StepExecutor.execute() catch block detects TripWire
  ↓
Returns StepResult { status: 'failed', tripwire: { ... } }
  ↓
WorkflowEventProcessor stores result
  ↓
EventedExecutionEngine.execute() extracts tripwire from result
  ↓
invokeLifecycleCallbacks({ tripwire, status: 'failed' })
```

**Lifecycle callback integration:**

ExecutionEngine already has tripwire support (line 78, 109, 119):
```typescript
async invokeLifecycleCallbacks(result: {
  tripwire?: any;  ← Already exists
  ...
})
```

Just need to extract from step results and pass through.

---

### Feature 3: Writer API Exposure

**Current state:**

```typescript
// step-executor.ts lines 148-149
writer: undefined as any,  ← TODO marker
```

**Integration approach:**

Wire OutputWriter through the execution chain:

```
ExecutionEngine.execute({ outputWriter })
  ↓
WorkflowEventProcessor.processWorkflowStepRun({ outputWriter })
  ↓
StepExecutor.execute({ outputWriter, emitter })
  ↓
Build ToolStream(outputWriter)
  ↓
Pass to step.execute({ writer: toolStream })
```

**ToolStream construction:**

```typescript
// step-executor.ts
import { ToolStream } from '../../tools/stream';

async execute(params: {
  outputWriter?: OutputWriter;
  ...
}) {
  // Build ToolStream for this step
  const toolStream = params.outputWriter
    ? new ToolStream(
        {
          prefix: 'workflow-step',
          callId: step.id,
          name: step.id,
          runId: params.runId,
        },
        params.outputWriter
      )
    : undefined;

  const stepOutput = await step.execute({
    ...context,
    writer: toolStream,  ← Replace undefined
  });
}
```

**Files modified:**
1. `packages/core/src/workflows/evented/step-executor.ts` - Add `outputWriter` param, construct ToolStream, pass to context
2. `packages/core/src/workflows/evented/workflow-event-processor/index.ts` - Thread `outputWriter` through ProcessorArgs and handler calls
3. `packages/core/src/workflows/evented/execution-engine.ts` - Extract `outputWriter` from params and pass to first event

**Data flow:**

```
workflow.stream() provides outputWriter
  ↓
EventedExecutionEngine.execute({ outputWriter })
  ↓
Publishes 'workflow.start' with outputWriter in data
  ↓
WorkflowEventProcessor receives in ProcessorArgs
  ↓
Threads through to StepExecutor.execute({ outputWriter })
  ↓
StepExecutor constructs ToolStream(outputWriter)
  ↓
Agent step receives context.writer
  ↓
agent.stream().objectStream.pipeTo(context.writer)
```

**Type changes:**

```typescript
// workflow-event-processor/index.ts
export type ProcessorArgs = {
  outputWriter?: OutputWriter;  ← Add field
  ...
}
```

---

### Feature 4: Foreach Index Resume

**Current state:**

ForEach handler already uses `foreachIdx` for item extraction:
```typescript
// step-executor.ts line 42
foreachIdx?: number;

// step-executor.ts line 56
prevOutput: typeof params.foreachIdx === 'number'
  ? params.input?.[params.foreachIdx]
  : params.input

// workflow-event-processor/index.ts line 937
foreachIdx: step.type === 'foreach' ? executionPath[1] : undefined
```

Resume labels already store `foreachIndex`:
```typescript
// step-executor.ts lines 122-132
resumeLabels[label] = {
  stepId: step.id,
  foreachIndex: params.foreachIdx,  ← Already captured
}
```

**Problem:** When resuming via label, `foreachIndex` isn't extracted and passed to StepExecutor.

**Integration approach:**

Extract `foreachIndex` from resume label and pass as `foreachIdx` param:

```typescript
// workflow-event-processor/index.ts processWorkflowStepRun()
// Around line 900+ where resume happens

let foreachIdxForResume: number | undefined;

// Check if resuming via label
if (resumeSteps?.length > 0) {
  const snapshot = await workflowsStore?.loadWorkflowSnapshot({
    workflowName: workflowId,
    runId,
  });

  const resumeLabels = snapshot?.resumeLabels ?? {};
  const labelInfo = resumeLabels[resumeSteps[0]];

  if (labelInfo && typeof labelInfo.foreachIndex === 'number') {
    foreachIdxForResume = labelInfo.foreachIndex;
  }
}

const stepResult = await this.stepExecutor.execute({
  ...
  foreachIdx: foreachIdxForResume ?? (step.type === 'foreach' ? executionPath[1] : undefined),
});
```

**Files modified:**
1. `packages/core/src/workflows/evented/workflow-event-processor/index.ts` - Extract `foreachIndex` from resume labels and pass to StepExecutor

**Data flow:**

```
User calls workflow.resume({ label: 'my-label' })
  ↓
Load snapshot, extract resumeLabels from storage
  ↓
resumeLabels['my-label'] = { stepId: 'step-1', foreachIndex: 2 }
  ↓
WorkflowEventProcessor extracts foreachIndex: 2
  ↓
StepExecutor.execute({ foreachIdx: 2 })
  ↓
Extracts correct array item: input[2]
```

---

## Component Modification Summary

### StepExecutor (`step-executor.ts`)

**Current responsibility:** Execute individual steps with context

**Modifications:**
1. Add `outputWriter?: OutputWriter` parameter
2. Construct `ToolStream` from outputWriter when present
3. Pass `writer: toolStream` to step context (replace `undefined`)
4. Detect TripWire in catch block, populate `stepResult.tripwire`

**Lines modified:** ~30 lines
- Line 42: Add outputWriter param
- Lines 148-154: Replace writer construction
- Lines 213-227: Add TripWire detection in catch

---

### WorkflowEventProcessor (`workflow-event-processor/index.ts`)

**Current responsibility:** Event routing and state machine

**Modifications:**
1. Add `outputWriter?: OutputWriter` to ProcessorArgs type
2. Thread outputWriter through handler calls (foreach, parallel, conditional, etc)
3. Extract `foreachIndex` from resume labels when resuming
4. Pass foreachIndex to StepExecutor when resuming via label

**Lines modified:** ~50 lines
- Line 48: Add outputWriter to ProcessorArgs
- Lines 485-697: Thread outputWriter to handlers (6-8 call sites)
- Lines 900-940: Extract foreachIndex from resume labels

---

### EventedExecutionEngine (`execution-engine.ts`)

**Current responsibility:** Execute workflow, subscribe to finish events, invoke callbacks

**Modifications:**
1. Extract `outputWriter` from params
2. Pass outputWriter in initial 'workflow.start' event data
3. Extract tripwire from step results
4. Pass tripwire to `invokeLifecycleCallbacks()`

**Lines modified:** ~20 lines
- Line 75: Already has outputWriter in params signature (verify)
- Lines 86-137: Extract outputWriter and pass to publish
- Lines 140-280: Extract tripwire from resultData.stepResults and pass to callbacks

---

### Handler Files (`loop.ts`, `parallel.ts`)

**Current responsibility:** Handle control flow constructs

**Modifications:**
1. Accept `outputWriter` in handler params
2. Pass outputWriter through to recursive StepExecutor calls

**Lines modified:** ~15 lines per file
- Add outputWriter to handler function signatures
- Pass through to StepExecutor.execute() calls

---

## Dependency Order

Features have minimal interdependencies, can be implemented in parallel:

```
Feature 1: V2 Model Support
├─ Standalone (agent-only change)
└─ No dependencies

Feature 2: TripWire Propagation
├─ Depends on: step-executor.ts catch block
└─ Depends on: execution-engine.ts callback wiring

Feature 3: Writer API
├─ Depends on: step-executor.ts ToolStream construction
├─ Depends on: workflow-event-processor.ts threading
└─ Depends on: execution-engine.ts initial event

Feature 4: Foreach Index Resume
├─ Depends on: workflow-event-processor.ts resume label extraction
└─ No other dependencies
```

**Recommended build order:**

1. **V2 Model Support** - Standalone agent change, no workflow impact
2. **TripWire Propagation** - Small modification, touches 2 files
3. **Foreach Index Resume** - Small modification, touches 1 file
4. **Writer API** - Largest change, threads through 4+ files

Or in parallel:
- Track 1: V2 + TripWire (related to agent execution)
- Track 2: Writer API (threading outputWriter)
- Track 3: Foreach Index Resume (label handling)

## Testing Strategy

### V2 Model Support
**Test file:** `evented-workflow.test.ts`
**Test approach:** Run agent step with V2 model, verify no error thrown
**Edge cases:**
- V1 model still works
- V2 model with structured output
- V2 model with streaming

### TripWire Propagation
**Test file:** `evented-workflow.test.ts`
**Test approach:** Agent throws TripWire, verify stepResult.tripwire populated and passed to onError callback
**Edge cases:**
- TripWire with retry: true
- TripWire with custom metadata
- TripWire vs regular Error

### Writer API
**Test file:** `evented-workflow.test.ts`
**Test approach:** Agent step calls context.writer.write(), verify output emitted
**Edge cases:**
- writer.write() for object chunks
- writer.custom() for custom chunks
- Agent stream piped to writer
- Nested workflow step with writer

### Foreach Index Resume
**Test file:** `evented-workflow.test.ts`
**Test approach:** Foreach suspends on item 2, resume via label, verify correct item processed
**Edge cases:**
- Resume via label with foreachIndex
- Resume via stepId (normal path, no foreachIndex)
- Partial concurrent foreach resume

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OutputWriter threading breaks existing flows | HIGH | Add outputWriter as optional param, verify undefined handling |
| TripWire detection false positives | MEDIUM | Use `instanceof TripWire` check, not duck typing |
| Foreach resume label not found | MEDIUM | Fallback to executionPath[1] if label lookup fails |
| V2 model incompatibility | LOW | Agent handles internally, workflow unaware |

## Open Questions

None—all integration points are clear from existing code structure.

## Architecture Patterns to Follow

### 1. Event Data Threading

**Pattern:** Add new fields to event data, thread through handler chain

**Example:**
```typescript
// Add to ProcessorArgs type
export type ProcessorArgs = {
  outputWriter?: OutputWriter;  // New field
  ...existing fields
}

// Thread through handlers
await pubsub.publish('workflows', {
  type: 'workflow.step.run',
  data: {
    ...existingData,
    outputWriter,  // Pass through
  }
});
```

### 2. Conditional Parameter Passing

**Pattern:** Extract params from storage or context, pass when available

**Example:**
```typescript
// Extract from storage if needed
const foreachIdx = resumeLabel?.foreachIndex
  ?? (step.type === 'foreach' ? executionPath[1] : undefined);

// Pass conditionally
await stepExecutor.execute({
  foreachIdx: foreachIdx,  // May be undefined
});
```

### 3. Error Metadata Extraction

**Pattern:** Check error type, extract typed metadata into result

**Example:**
```typescript
catch (error: any) {
  let tripwireInfo: StepTripwireInfo | undefined;
  if (error instanceof TripWire) {
    tripwireInfo = {
      reason: error.message,
      retry: error.options.retry,
      metadata: error.options.metadata,
    };
  }
  return { status: 'failed', error, tripwire: tripwireInfo };
}
```

## Anti-Patterns to Avoid

### 1. State Machine Short-Circuits

**Don't:** Bypass event-driven flow to pass data directly

**Example (BAD):**
```typescript
// Don't store writer in class property
this.currentWriter = outputWriter;
```

**Why:** Breaks distributed execution, loses event-driven benefits

**Instead:** Thread through ProcessorArgs and event data

---

### 2. Type Casting Assumptions

**Don't:** Assume error types without runtime checks

**Example (BAD):**
```typescript
const tripwire = error as TripWire;
```

**Why:** Regular errors will be misinterpreted

**Instead:** Use instanceof checks

---

### 3. Mutation of Shared State

**Don't:** Modify stepResults or ProcessorArgs in place

**Example (BAD):**
```typescript
stepResults.tripwire = { ... };
```

**Why:** Other handlers may read stale state

**Instead:** Return new objects, let processor merge

---

## Performance Considerations

All features are **zero-cost when not used**:

1. **V2 Model Support** - No workflow overhead, agent-only
2. **TripWire Propagation** - Single instanceof check in error path (cold path)
3. **Writer API** - ToolStream constructed only when outputWriter provided
4. **Foreach Index Resume** - Label lookup only during resume (cold path)

No hot-path performance impact expected.

## Compatibility

### Backward Compatibility

All features are **fully backward compatible**:

- V1 models continue using streamLegacy (no change)
- Non-TripWire errors handled as before
- undefined writer handled (agent streams still work without it)
- Non-label resume uses executionPath as before

### Forward Compatibility

Features align with default runtime patterns:
- TripWire propagation matches default runtime behavior
- Writer API matches default runtime context
- Foreach index resume matches default runtime resume API

No drift introduced.

## Sources

**HIGH confidence** - Extracted from evented runtime codebase:
- `packages/core/src/workflows/evented/step-executor.ts` (500 lines)
- `packages/core/src/workflows/evented/workflow-event-processor/index.ts` (1580 lines)
- `packages/core/src/workflows/evented/execution-engine.ts` (283 lines)
- `packages/core/src/workflows/evented/workflow-event-processor/loop.ts` (311 lines)
- `packages/core/src/workflows/evented/workflow-event-processor/parallel.ts` (202 lines)
- `packages/core/src/agent/trip-wire.ts` (110 lines)
- `packages/core/src/tools/stream.ts` (76 lines)
- `packages/core/src/workflows/types.ts` (StepTripwireInfo interface)
- `.planning/PROJECT.md` (v1.1 milestone requirements)
