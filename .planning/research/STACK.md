# Technology Stack: V1.1 Agent Integration Features

**Project:** Mastra Evented Workflow Runtime v1.1
**Milestone:** Agent Integration Parity (V2 models, TripWire, Writer API, foreach index)
**Researched:** 2026-01-27
**Overall Confidence:** HIGH (based on codebase analysis)

## Executive Summary

The v1.1 milestone adds four agent integration features to the evented workflow runtime. All four features already exist in the default runtime. The evented runtime currently uses `streamLegacy()` for agent steps, which blocks V2 model support. The stack changes are minimal but targeted: detect model version, call appropriate method, pass writer context, handle tripwire chunks, and expose foreach index to suspend metadata.

## Stack Change Overview

| Feature | Current State | Required Change | Complexity |
|---------|--------------|-----------------|------------|
| V2 Model Support | Uses `streamLegacy()` only | Detect model version, call `.stream()` for V2+ | Low |
| TripWire Propagation | Not handled | Catch tripwire chunks, throw TripWire | Low |
| Writer API | Stubbed as `undefined` | Pass ToolStream instance | Low |
| Foreach Index Resume | Not exposed | Add to suspend metadata | Low |

## Feature 1: V2 Model Support

### Current Implementation (Default Runtime)

**File:** `packages/core/src/workflows/workflow.ts` (lines 381-416)

```typescript
if ((await params.getModel()).specificationVersion === 'v1') {
  const { fullStream } = await params.streamLegacy(/* ... */);
  stream = fullStream as any;
} else {
  const modelOutput = await params.stream(/* ... */);
  stream = modelOutput.fullStream;
}
```

**Key APIs:**
- `agent.getModel()` returns model info including `specificationVersion`
- `supportedLanguageModelSpecifications` = `['v2', 'v3']`
- `isSupportedLanguageModel(model)` checks if version is in supported list

### Evented Runtime Gap

**File:** `packages/core/src/workflows/evented/workflow.ts` (lines 336-348)

```typescript
// TODO: should use regular .stream()
const { fullStream } = await params.streamLegacy((inputData as { prompt: string }).prompt, {
  ...(agentOptions ?? {}),
  tracingContext,
  requestContext,
  onFinish: result => {
    streamPromise.resolve(result.text);
  },
  abortSignal,
});
```

**Problem:** Always calls `streamLegacy()`, which throws error for V2+ models.

### Required Stack Changes

**1. Add Model Version Detection**

```typescript
const model = await params.getModel();
const isV2OrHigher = supportedLanguageModelSpecifications.includes(model.specificationVersion);
```

**2. Conditional Method Call**

```typescript
if (model.specificationVersion === 'v1') {
  const { fullStream } = await params.streamLegacy(/* ... */);
  stream = fullStream as any;
} else {
  const modelOutput = await params.stream(/* ... */);
  stream = modelOutput.fullStream;
}
```

**3. Handle Structured Output**

V2 models support structured output via `agentOptions?.structuredOutput?.schema`. If present, capture from `result.object`:

```typescript
onFinish: result => {
  const resultWithObject = result as typeof result & { object?: unknown };
  if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
    structuredResult = resultWithObject.object;
  }
  streamPromise.resolve(result.text);
}
```

### Integration Points

**Import Required:**
```typescript
import { supportedLanguageModelSpecifications } from '../../agent/utils';
```

**No Breaking Changes:** This is backward compatible. V1 models continue using `streamLegacy()`.

### Sources

- **HIGH confidence:** `packages/core/src/workflows/workflow.ts:381` (default runtime implementation)
- **HIGH confidence:** `packages/core/src/agent/utils.ts:10-15` (version detection)
- **HIGH confidence:** `packages/core/src/workflows/evented/workflow.ts:336-390` (evented runtime current state)

## Feature 2: TripWire Propagation

### Current Implementation (Default Runtime)

**File:** `packages/core/src/workflows/workflow.ts` (lines 418-464)

```typescript
let tripwireChunk: any = null;

// In stream consumption loop:
for await (const chunk of stream) {
  if (chunk.type === 'tripwire') {
    tripwireChunk = chunk;
    break;
  }
  // ... handle other chunks
}

// After loop:
if (tripwireChunk) {
  throw new TripWire(
    tripwireChunk.payload?.reason || 'Agent tripwire triggered',
    {
      retry: tripwireChunk.payload?.retry,
      metadata: tripwireChunk.payload?.metadata,
    },
    tripwireChunk.payload?.processorId,
  );
}
```

**Key APIs:**
- **Chunk Type:** `{ type: 'tripwire'; payload: TripwirePayload }`
- **TripWire Class:** `new TripWire(reason, options, processorId)`
- **TripwirePayload Interface:** `{ reason: string; retry?: boolean; metadata?: unknown; processorId?: string }`

### Evented Runtime Gap

**File:** `packages/core/src/workflows/evented/workflow.ts` (lines 372-390)

```typescript
for await (const chunk of fullStream) {
  if (chunk.type === 'text-delta') {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
    });
  }
}
```

**Problem:** No tripwire handling. Tripwire chunks are silently ignored.

### Required Stack Changes

**1. Add Tripwire Detection**

```typescript
let tripwireChunk: any = null;

for await (const chunk of fullStream) {
  if (chunk.type === 'tripwire') {
    tripwireChunk = chunk;
    break; // Stop consuming stream
  }
  // ... existing chunk handling
}
```

**2. Throw TripWire After Stream**

```typescript
// After stream consumption, before abort check:
if (tripwireChunk) {
  throw new TripWire(
    tripwireChunk.payload?.reason || 'Agent tripwire triggered',
    {
      retry: tripwireChunk.payload?.retry,
      metadata: tripwireChunk.payload?.metadata,
    },
    tripwireChunk.payload?.processorId,
  );
}
```

**3. Error Propagation**

The thrown `TripWire` will be caught by `StepExecutor.execute()` (line 213-227), which returns:

```typescript
return {
  ...stepInfo,
  status: 'failed',
  endedAt,
  error: errorInstance,
};
```

The `WorkflowEventProcessor` will then serialize the tripwire data and persist it with the step result.

### Integration Points

**Import Required:**
```typescript
import { TripWire } from '../../agent/trip-wire';
```

**Already Imported:** The evented workflow file already imports TripWire (line 8), so no new imports needed.

### TripWire Mechanism Details

**How TripWire Works:**

1. **Processor Detection:** Output processors in agent execution can call `abort(reason, { retry: true, metadata: {...} })`
2. **Chunk Emission:** This creates a tripwire chunk in the agent stream
3. **Workflow Handling:** Workflow step catches tripwire chunk and throws `TripWire` error
4. **Retry Logic:** If `retry: true`, the workflow can retry the step with feedback
5. **Serialization:** TripWire data is serialized to step results for persistence

**TripWire Chunk Structure:**

```typescript
interface TripwirePayload<TMetadata = unknown> {
  reason: string;           // Required: why tripwire triggered
  retry?: boolean;          // Optional: should agent retry with feedback
  metadata?: TMetadata;     // Optional: processor-specific data
  processorId?: string;     // Optional: which processor triggered
}
```

### Sources

- **HIGH confidence:** `packages/core/src/workflows/workflow.ts:418-464` (default runtime implementation)
- **HIGH confidence:** `packages/core/src/agent/trip-wire.ts:1-110` (TripWire class definition)
- **HIGH confidence:** `packages/core/src/stream/types.ts:334-343` (TripwirePayload interface)

## Feature 3: Writer API

### Current Implementation (Default Runtime)

**File:** `packages/core/src/workflows/handlers/step.ts` (lines 389-397)

```typescript
writer: new ToolStream(
  {
    prefix: 'workflow-step',
    callId: stepCallId,
    name: step.id,
    runId,
  },
  outputWriter,
),
```

**Key APIs:**
- **ToolStream Class:** Writable stream wrapper for step output
- **OutputWriter Type:** `(chunk: TChunk) => Promise<void>`
- **Writer Methods:** `write(data)`, `custom(data)` for custom chunks

### Evented Runtime Gap

**File:** `packages/core/src/workflows/evented/step-executor.ts` (lines 149, 327, 402, 477)

```typescript
writer: undefined as any,
```

**Problem:** Writer is stubbed as undefined. Steps that use `context.writer` will fail.

### Required Stack Changes

**1. Accept OutputWriter Parameter**

`StepExecutor.execute()` already accepts parameters but doesn't receive `outputWriter`. Add to signature:

```typescript
async execute(params: {
  // ... existing params
  outputWriter?: OutputWriter;
}): Promise<StepResult<any, any, any, any>> {
```

**2. Create ToolStream Instance**

```typescript
const stepCallId = randomUUID(); // Generate unique call ID

const toolStream = new ToolStream(
  {
    prefix: 'workflow-step',
    callId: stepCallId,
    name: step.id,
    runId,
  },
  params.outputWriter,
);
```

**3. Pass to Step Context**

Replace `writer: undefined as any` with `writer: toolStream`:

```typescript
const stepOutput = await step.execute(
  createDeprecationProxy(
    {
      // ... existing context
      writer: toolStream,
      // ... rest of context
    },
    // ... deprecation config
  ),
);
```

**4. Repeat for All Context Objects**

The `StepExecutor` has multiple methods that create execution contexts:
- `execute()` - line 149
- `evaluateCondition()` - line 327
- `resolveSleep()` - line 402
- `resolveSleepUntil()` - line 477

All need the same writer pattern, though sleep/condition contexts may use a no-op writer if outputWriter is undefined.

### Integration Points

**Import Required:**
```typescript
import { randomUUID } from 'node:crypto';
import { ToolStream } from '../../tools/stream';
import type { OutputWriter } from '../types';
```

**Already Imported:** The evented step-executor.ts already has EventEmitter import. Need to add ToolStream and OutputWriter.

### Writer API Usage Patterns

**1. Direct Write:**
```typescript
await context.writer.write({ foo: 'bar' });
```

**2. Custom Chunks:**
```typescript
await context.writer.custom({
  type: 'data-custom-event',
  payload: { ... }
});
```

**3. Nested Agent Streams:**

When an agent step calls `agent.stream()`, chunks bubble up through the writer:

```typescript
// In agent step execution (default runtime, lines 2054-2062):
for await (const chunk of streamResult.fullStream) {
  if (context?.writer) {
    if (chunk.type.startsWith('data-')) {
      await context.writer.custom(chunk as any);
    } else {
      await context.writer.write(chunk);
    }
  }
}
```

### Sources

- **HIGH confidence:** `packages/core/src/workflows/handlers/step.ts:389-397` (default runtime)
- **HIGH confidence:** `packages/core/src/tools/stream.ts:1-76` (ToolStream implementation)
- **HIGH confidence:** `packages/core/src/workflows/types.ts:20` (OutputWriter type)
- **HIGH confidence:** `packages/core/src/agent/agent.ts:2054-2094` (writer usage in agent steps)

## Feature 4: Foreach Index Resume

### Current Implementation (Default Runtime)

**File:** `packages/core/src/workflows/handlers/control-flow.ts` (lines 840-986)

```typescript
const foreachIndexObj: Record<number, any> = {};
const resumeIndex = prevPayload?.status === 'suspended'
  ? prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0
  : 0;

// In loop execution:
for (let i = 0; i < prevOutput.length; i += concurrency) {
  const items = prevOutput.slice(i, i + concurrency);
  const itemsResults = await Promise.all(
    items.map(async (item: any, j: number) => {
      const k = i + j;

      // Resume logic:
      let resumeToUse = undefined;
      if (resume?.forEachIndex !== undefined) {
        resumeToUse = resume.forEachIndex === k ? resume : undefined;
      } else {
        const isIndexSuspended = prevItemResult?.status === 'suspended' || resumeIndex === k;
        if (isIndexSuspended) {
          resumeToUse = resume;
        }
      }

      const stepExecResult = await engine.executeStep({
        // ... other params
        executionContext: { ...executionContext, foreachIndex: k },
        resume: resumeToUse,
        // ...
      });
    })
  );

  // On suspend, save index:
  if (Object.keys(foreachIndexObj).length > 0) {
    const suspendedIndices = Object.keys(foreachIndexObj).map(Number);
    const foreachIndex = suspendedIndices[0]!;

    return {
      status: 'suspended',
      suspendPayload: {
        ...foreachIndexObj[foreachIndex].suspendPayload,
        __workflow_meta: {
          ...foreachIndexObj[foreachIndex].suspendPayload?.__workflow_meta,
          foreachIndex,
          foreachOutput: prevForeachOutput,
          resumeLabels: executionContext.resumeLabels,
        },
      },
    };
  }
}
```

**Key APIs:**
- **ExecutionContext:** `{ foreachIndex: number }` passed to step executor
- **Suspend Metadata:** `__workflow_meta.foreachIndex` stores suspended iteration
- **Resume Parameter:** `resume.forEachIndex` specifies which iteration to resume

### Evented Runtime Gap

**File:** `packages/core/src/workflows/evented/step-executor.ts` (lines 42-130)

```typescript
async execute(params: {
  // ...
  foreachIdx?: number;  // Accepted but not used in suspend metadata
}) {
  // Input validation uses foreachIdx to extract correct item:
  const { inputData, validationError } = await validateStepInput({
    prevOutput: typeof params.foreachIdx === 'number' ? params.input?.[params.foreachIdx] : params.input,
    step,
    validateInputs: params.validateInputs ?? true,
  });

  // But suspend metadata doesn't include foreachIndex:
  const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
  if (suspendOptions?.resumeLabel) {
    for (const label of labels) {
      resumeLabels[label] = {
        stepId: step.id,
        foreachIndex: params.foreachIdx,  // ← Only in resumeLabels, not in suspend payload
      };
    }
  }

  suspended = {
    payload: {
      ...suspendData,
      __workflow_meta: {
        runId,
        path: [step.id],
        resumeLabels: Object.keys(resumeLabels).length > 0 ? resumeLabels : undefined,
        // Missing: foreachIndex
      },
    },
  };
}
```

**Problem:** The `foreachIdx` is used for input extraction but not stored in suspend metadata.

### Required Stack Changes

**1. Store foreachIndex in Suspend Metadata**

In `StepExecutor.execute()`, when building suspended result (lines 122-143):

```typescript
suspended = {
  payload: {
    ...suspendData,
    __workflow_meta: {
      runId,
      path: [step.id],
      resumeLabels: Object.keys(resumeLabels).length > 0 ? resumeLabels : undefined,
      foreachIndex: params.foreachIdx,  // ← ADD THIS
    },
  },
};
```

**2. Add to Resume Metadata Type**

The `__workflow_meta` type should include `foreachIndex?`:

```typescript
__workflow_meta: {
  runId: string;
  path: string[];
  resumeLabels?: Record<string, { stepId: string; foreachIndex?: number }>;
  foreachIndex?: number;  // ← ADD THIS
}
```

**3. Use in Resume Logic**

The foreach loop processor (`workflow-event-processor/loop.ts`) should extract foreachIndex from suspend metadata when resuming:

```typescript
const resumeIndex = prevPayload?.status === 'suspended'
  ? prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0
  : 0;
```

This allows precise resume to the exact iteration that suspended.

### Integration Points

**No New Imports:** Uses existing `params.foreachIdx` parameter.

**Type Update:** The `__workflow_meta` structure is internal and doesn't have a formal type definition. Adding `foreachIndex` is backward compatible.

### Foreach Resume Flow

**1. Foreach Loop Starts:**
```typescript
for (let i = 0; i < items.length; i++) {
  await stepExecutor.execute({
    // ...
    foreachIdx: i,
  });
}
```

**2. Step Suspends at Iteration 5:**
```typescript
// Stored in suspend payload:
{
  __workflow_meta: {
    foreachIndex: 5,
    // ...
  }
}
```

**3. Workflow Resumes:**
```typescript
// Loop processor reads foreachIndex from stored metadata:
const resumeIndex = suspendPayload.__workflow_meta.foreachIndex; // 5

// Skips iterations 0-4, resumes at 5:
for (let i = resumeIndex; i < items.length; i++) {
  // ...
}
```

### Sources

- **HIGH confidence:** `packages/core/src/workflows/handlers/control-flow.ts:840-986` (default runtime)
- **HIGH confidence:** `packages/core/src/workflows/evented/step-executor.ts:42-143` (evented runtime)
- **HIGH confidence:** `packages/core/src/workflows/evented/workflow-event-processor/loop.ts:231-282` (foreach loop handling)

## Implementation Strategy

### Phase 1: V2 Model Support + TripWire (Coupled)

These two features are naturally coupled because:
1. Both involve stream consumption loop changes
2. Tripwire chunks only appear in V2 model streams (via processor support)
3. Testing requires V2 models with processors

**Implementation steps:**
1. Add model version detection to `createStepFromAgent()`
2. Conditional method call (`.stream()` vs `.streamLegacy()`)
3. Add tripwire chunk detection in stream loop
4. Throw TripWire after stream consumption
5. Handle structured output for V2 models

**Test with:** Agent step using V2 model + output processor that triggers abort.

### Phase 2: Writer API (Independent)

This feature is independent and can be implemented separately:
1. Add `outputWriter` parameter to `StepExecutor.execute()`
2. Create `ToolStream` instance in step executor
3. Pass to step execution context
4. Update all context creation points (execute, evaluateCondition, resolveSleep, resolveSleepUntil)

**Test with:** Step that calls `context.writer.write()` and `context.writer.custom()`.

### Phase 3: Foreach Index (Independent)

This feature is independent and can be implemented separately:
1. Add `foreachIndex: params.foreachIdx` to suspend metadata
2. Update loop processor to read from metadata
3. Test resume logic

**Test with:** Foreach loop that suspends at iteration N and resumes.

## Anti-Patterns to Avoid

### 1. Mixing streamLegacy and stream Result Types

**Anti-pattern:** Treating both streams identically without checking chunk differences.

**Why bad:**
- `streamLegacy()` uses `chunk.textDelta` (string)
- `stream()` uses `chunk.payload.text` (TextDeltaPayload)

**Instead:** Check model version and handle appropriately.

### 2. Ignoring Structured Output

**Anti-pattern:** Only returning `{ text: string }` for V2 models.

**Why bad:** Loses structured output capability, breaks type safety.

**Instead:** Capture `result.object` when `structuredOutput.schema` is provided.

### 3. Silent Tripwire Failure

**Anti-pattern:** Continuing stream consumption after tripwire chunk.

**Why bad:** Wastes tokens, ignores processor decision.

**Instead:** Break loop immediately on tripwire, throw TripWire error.

### 4. Stubbing Writer as Undefined

**Anti-pattern:** Keeping `writer: undefined as any` after implementation.

**Why bad:** Steps that use writer will fail at runtime with cryptic errors.

**Instead:** Always provide ToolStream, even if no-op when outputWriter is undefined.

### 5. Hardcoding foreachIndex to 0

**Anti-pattern:** Always resuming from index 0 in foreach loops.

**Why bad:** Re-executes completed iterations, wastes resources.

**Instead:** Read foreachIndex from suspend metadata, resume from exact iteration.

## Testing Strategy

### V2 Model Tests

**Existing test:** `packages/core/src/workflows/evented/evented-workflow.test.ts:12831-12935`

Currently skipped with message:
```typescript
it.skip('should pass agentOptions when wrapping agent with createStep - evented runtime uses streamLegacy which does not support V2 models', async () => {
  // ...
});
```

**After implementation:** Un-skip these tests and verify they pass.

### TripWire Tests

**New test needed:** Agent step with output processor that calls `abort()`:

```typescript
it('should propagate TripWire from agent processor', async () => {
  const agent = new Agent({
    model: { ... },
    outputProcessors: [
      {
        id: 'quality-check',
        execute: async ({ abort }) => {
          abort('Quality threshold not met', { retry: true, metadata: { score: 0.3 } });
        },
      },
    ],
  });

  const workflow = createWorkflow({ ... });
  const result = await workflow.execute();

  expect(result.status).toBe('failed');
  expect(result.steps.agentStep.tripwire).toEqual({
    reason: 'Quality threshold not met',
    retry: true,
    metadata: { score: 0.3 },
    processorId: 'quality-check',
  });
});
```

### Writer Tests

**New test needed:** Step that writes custom data via writer:

```typescript
it('should expose writer API in step context', async () => {
  const chunks: any[] = [];

  const workflow = createWorkflow({
    outputWriter: async (chunk) => {
      chunks.push(chunk);
    },
  });

  await workflow.execute();

  expect(chunks).toContainEqual({
    type: 'workflow-step-output',
    payload: { output: { custom: 'data' } },
  });
});
```

### Foreach Index Tests

**New test needed:** Foreach loop suspend/resume:

```typescript
it('should resume foreach at correct index', async () => {
  const workflow = createWorkflow({ ... });

  // First execution suspends at index 5:
  const result1 = await workflow.execute({ items: [0,1,2,3,4,5,6,7,8,9] });
  expect(result1.status).toBe('suspended');
  expect(result1.suspendPayload.__workflow_meta.foreachIndex).toBe(5);

  // Resume should skip 0-5, start at 5:
  const result2 = await workflow.resume({ runId: result1.runId });
  expect(result2.status).toBe('success');
  // Verify only iterations 5-9 executed
});
```

## Dependencies

### Required Imports

**For V2 Model Support:**
```typescript
import { supportedLanguageModelSpecifications } from '../../agent/utils';
```

**For TripWire:**
```typescript
import { TripWire } from '../../agent/trip-wire';
```
*(Already imported in evented/workflow.ts)*

**For Writer API:**
```typescript
import { randomUUID } from 'node:crypto';
import { ToolStream } from '../../tools/stream';
import type { OutputWriter } from '../types';
```

**For Foreach Index:**
*(No new imports needed)*

### No New External Dependencies

All required functionality exists in the codebase. No package.json changes needed.

## Confidence Assessment

| Feature | Confidence | Reason |
|---------|-----------|--------|
| V2 Model Support | HIGH | Default runtime implementation verified, model detection API documented |
| TripWire Propagation | HIGH | TripWire class and chunk structure verified, default runtime flow documented |
| Writer API | HIGH | ToolStream implementation verified, default runtime usage patterns documented |
| Foreach Index | HIGH | Default runtime foreach logic verified, suspend metadata structure documented |

## Open Questions

1. **Streaming format differences:** Do V2 models use different event structure for workflow streaming?
   - **Answer:** Yes, V2 uses `chunk.payload.text` vs V1 `chunk.textDelta`. Code must handle both.

2. **TripWire serialization:** How does TripWire data persist across process restarts?
   - **Answer:** Serialized to plain object in step results, restored as plain object (not TripWire instance).

3. **Writer with no outputWriter:** What happens if step uses writer but no outputWriter provided?
   - **Answer:** ToolStream wraps undefined outputWriter, methods become no-ops. Safe to call.

4. **Foreach concurrent suspends:** What if multiple iterations suspend in parallel?
   - **Answer:** Default runtime handles via `foreachIndexObj` collecting all suspended indices. Evented must match this.

## Sources

- **HIGH confidence:** Mastra codebase analysis
  - `packages/core/src/workflows/workflow.ts:381-482` (default runtime agent steps)
  - `packages/core/src/workflows/evented/workflow.ts:306-393` (evented runtime agent steps)
  - `packages/core/src/workflows/evented/step-executor.ts` (evented step execution)
  - `packages/core/src/workflows/handlers/control-flow.ts:840-986` (foreach implementation)
  - `packages/core/src/agent/trip-wire.ts` (TripWire class)
  - `packages/core/src/tools/stream.ts` (ToolStream implementation)
  - `packages/core/src/stream/types.ts` (chunk type definitions)
