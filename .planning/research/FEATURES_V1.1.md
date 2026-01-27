# Feature Landscape: v1.1 Agent Integration Features

**Domain:** Workflow Runtime - Agent Integration Parity
**Researched:** 2026-01-27
**Focus:** V2 model support, TripWire propagation, Writer API, Foreach index resume

## Table Stakes

Features that MUST work identically to default runtime for parity.

### 1. V2/V3 Model Support for Agent Steps

**What it is:** Agent steps can use LanguageModelV2 (AI SDK v5) or LanguageModelV3 (AI SDK v6) models.

**Expected behavior:**
- Agent constructor accepts `MastraModelConfig` which includes V2/V3 models
- Model type detected via `specificationVersion` field (v2 or v3)
- Both V2 and V3 models wrapped to unified interface (`MastraLanguageModelV2`, `MastraLanguageModelV3`)
- Agent execution (`stream()`, `generate()`) works transparently with V2/V3 models
- No special handling needed in workflow runtime - agents handle model version internally

**Complexity:** Low
**Implementation in default runtime:**
- `packages/core/src/agent/agent.ts` - Agent constructor resolves model config
- `packages/core/src/llm/model/shared.types.ts` - Type definitions for V2/V3 models
- `packages/core/src/agent/utils.ts` - Model version detection via `supportedLanguageModelSpecifications`
- Agent steps in workflows call `agent.stream()` or `agent.generate()` normally

**Notes:**
- This is primarily an agent concern, not a workflow runtime concern
- Workflow runtime just needs to pass through the agent execution correctly
- V2 models added in AI SDK v5, V3 in v6
- Both unified to return streams via `doGenerate`/`doStream`

**Test cases (from workflow.test.ts):**
- Line 12: Imports `MastraLanguageModelV2Mock`
- Line 7178+: Agent error handling tests use MockLanguageModelV2
- Multiple tests verify agent.stream() and agent.generate() work in workflow steps

### 2. TripWire Propagation from Agents to Workflow

**What it is:** When an agent throws a TripWire (from processor rejection), the workflow step fails with `status: 'tripwire'` and preserves tripwire metadata.

**Expected behavior:**
1. Agent processor throws `TripWire` error with reason, retry flag, metadata, processorId
2. Step execution catches TripWire in retry handler
3. Step result includes `tripwire` field with serialized data
4. Workflow result converts status from 'failed' to 'tripwire' when tripwire present
5. Step failure includes: `{ status: 'failed', error: Error, tripwire: { reason, retry?, metadata?, processorId? } }`
6. Final workflow result: `{ status: 'tripwire', tripwire: {...} }`

**Complexity:** Medium
**Implementation in default runtime:**
- `packages/core/src/agent/trip-wire.ts` - TripWire class definition
- `packages/core/src/workflows/types.ts` lines 67-89 - StepTripwireInfo interface, tripwire field on StepFailure
- `packages/core/src/workflows/default.ts` lines 452-462 - Catch TripWire and serialize to plain object
- `packages/core/src/workflows/default.ts` lines 500-518 - Convert 'failed' to 'tripwire' status in fmtReturnValue
- `packages/core/src/workflows/handlers/control-flow.ts` lines 183-188, 479-485 - Preserve tripwire through parallel/conditional

**Key implementation details:**
```typescript
// In executeStepWithRetry catch block:
tripwire: e instanceof TripWire
  ? {
      reason: e.message,
      retry: e.options?.retry,
      metadata: e.options?.metadata,
      processorId: e.processorId,
    }
  : undefined
```

```typescript
// In fmtReturnValue:
if (tripwireData instanceof TripWire) {
  base.status = 'tripwire';
  base.tripwire = { reason, retry, metadata, processorId };
} else if (tripwireData && typeof tripwireData === 'object' && 'reason' in tripwireData) {
  base.status = 'tripwire';
  base.tripwire = tripwireData;
}
```

**Test cases:**
- Workflow tests at lines 7169+ verify agent.stream() errors propagate with full details
- Control flow tests verify tripwire preserved through parallel/conditional branches

**Notes:**
- TripWire must be serialized to plain object for durability
- Status conversion happens at workflow result formatting, not during step execution
- Tripwire field is OPTIONAL on StepFailure - only present when TripWire thrown

### 3. Writer API Exposure in Step Context

**What it is:** Steps receive a `writer` parameter with `.write()` and `.custom()` methods for streaming output.

**Expected behavior:**
1. Each step receives `writer: ToolStream` in execution context
2. Writer is namespaced by step: `{ prefix: 'workflow-step', callId, name: stepId, runId }`
3. `writer.write(data)` - Wraps data in `workflow-step-output` chunk with step metadata
4. `writer.custom(data)` - Passes data chunk directly through (for custom chunk types)
5. Writer delegates to `outputWriter` function if provided (from streaming)
6. Works in parallel steps without locking (each step gets isolated writer instance)

**Complexity:** Low
**Implementation in default runtime:**
- `packages/core/src/tools/stream.ts` - ToolStream class with write/custom methods
- `packages/core/src/workflows/handlers/step.ts` line 389 - Create ToolStream per step execution
- `packages/core/src/workflows/step.ts` line 55 - Writer exposed in ExecuteFunctionParams
- `packages/core/src/workflows/__tests__/parallel-writer.test.ts` - Tests parallel writer usage

**ToolStream implementation:**
```typescript
class ToolStream {
  async write(data: any) {
    await writeFn({
      type: 'workflow-step-output',
      runId,
      from: 'USER',
      payload: { output: data, runId, stepName }
    });
  }

  async custom<T>(data: T) {
    await writeFn(data); // Pass through directly
  }
}
```

**Test cases:**
- `parallel-writer.test.ts` - Verifies writer.custom works in parallel steps without locking
- `tool-stream.test.ts` lines 126+ - Tests writer.custom sends custom chunks correctly

**Notes:**
- Writer is per-step, created fresh for each step execution
- Parallel steps each get their own writer instance - no locking issues
- Custom chunks bypass wrapping, regular writes get wrapped with step metadata

### 4. Foreach Index Resume Parameter

**What it is:** When resuming a suspended foreach loop, can specify which iteration to resume.

**Expected behavior:**
1. Foreach stores suspended state in `__workflow_meta.foreachIndex`
2. Resume accepts `forEachIndex` parameter to target specific iteration
3. Without explicit index: resumes first suspended iteration (default behavior)
4. With explicit index: resumes only that iteration, skips others until that index
5. Completed iterations are skipped (cached results used)
6. Resume data flows to step execution with `foreachIndex` context

**Complexity:** High
**Implementation in default runtime:**
- `packages/core/src/workflows/handlers/control-flow.ts` lines 840-873 - Foreach resume logic
- `packages/core/src/workflows/handlers/control-flow.ts` line 883 - Pass foreachIndex to executionContext
- `packages/core/src/workflows/handlers/step.ts` line 370 - Forward forEachIndex to nested workflow resume
- `packages/core/src/workflows/workflow.ts` line 3451 - Resume API accepts forEachIndex parameter
- `packages/core/src/workflows/types.ts` line 760 - forEachIndex in ExecuteForeachParams

**Resume logic:**
```typescript
// Determine which iterations to resume
const resumeIndex = prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0;

for each item:
  // Skip completed or non-target suspended iterations
  if (prevItemResult?.status === 'success' ||
      (prevItemResult?.status === 'suspended' && resume?.forEachIndex !== k && resume?.forEachIndex !== undefined)) {
    return prevItemResult; // Use cached result
  }

  // Determine if this iteration should be resumed
  let resumeToUse = undefined;
  if (resume?.forEachIndex !== undefined) {
    resumeToUse = resume.forEachIndex === k ? resume : undefined; // Only resume exact match
  } else {
    const isIndexSuspended = prevItemResult?.status === 'suspended' || resumeIndex === k;
    if (isIndexSuspended) {
      resumeToUse = resume; // Resume first suspended
    }
  }

  // Execute with foreachIndex context
  executeStep({ executionContext: { ...executionContext, foreachIndex: k }, resume: resumeToUse })
```

**Test cases:**
- `evented-workflow.test.ts` lines 18912-18924 - Documents foreach suspend/resume expected behavior (SKIPPED in evented)
- Lines 18925+ - Six skipped tests for foreach suspend/resume scenarios
- Default runtime tests (workflow.test.ts around line 7678) verify the behavior

**Notes:**
- CRITICAL: Evented runtime currently does NOT implement forEachIndex parameter
- This is a known gap - skipped tests document expected behavior
- Foreach state stored in `__workflow_meta` internal object (filtered from user-facing suspendPayload)
- Resume without index: first suspended iteration resumed
- Resume with index: only that specific iteration resumed

## Differentiators

Features that would be nice to have but aren't required for parity.

### Enhanced Foreach Resume

**What:** Resume multiple iterations simultaneously, or resume by label instead of index.

**Value:** More flexible resume patterns for complex foreach scenarios.

**Why not priority:** Default runtime uses index-based resume. Labels are workflow-level, not foreach-iteration-level.

### Writer Buffering

**What:** Buffer writer output until step completes, then flush atomically.

**Value:** Prevents partial output on step failure/retry.

**Why not priority:** Default runtime writes immediately. Buffering would be behavior change.

## Anti-Features

Features to explicitly NOT build or behaviors to avoid.

### Custom Foreach Resume Logic

**What:** Allow custom resume logic per foreach (e.g., skip failed iterations, retry all).

**Why avoid:** Default runtime has fixed resume semantics. Custom logic breaks parity.

**What to do instead:** Match default runtime behavior exactly - resume by index or first suspended.

### Writer Queuing Across Steps

**What:** Queue writer output across multiple steps, flush at workflow end.

**Why avoid:** Breaks streaming semantics. Steps should output immediately.

**What to do instead:** Each step gets isolated writer, outputs immediately when called.

### Automatic TripWire Retry

**What:** Automatically retry steps when TripWire has `retry: true`.

**Why avoid:** TripWire is terminal for the workflow run. Retry logic is external (user calls resume).

**What to do instead:** Preserve tripwire data, set status to 'tripwire', let user handle retry externally.

## Feature Dependencies

```
V2 Model Support (independent)
  ↓
Agent Execution (uses V2 models)
  ↓
TripWire Propagation (catches errors from agents)

Writer API (independent)
  ↓
Parallel Steps (each step needs isolated writer)

Foreach Index (independent, but complex)
  ↓
Suspend/Resume (foreach needs special handling)
```

## MVP Recommendation

**Phase order for implementation:**

1. **V2 Model Support** (LOW complexity, independent)
   - Already handled by agent layer
   - Verify agent steps work with V2/V3 models in evented runtime

2. **Writer API** (LOW complexity, independent)
   - Create ToolStream instance per step
   - Wire to outputWriter in evented step executor
   - Verify parallel steps work

3. **TripWire Propagation** (MEDIUM complexity, depends on agent)
   - Catch TripWire in evented retry handler
   - Serialize to StepFailure.tripwire field
   - Convert status in result formatting

4. **Foreach Index Resume** (HIGH complexity, orthogonal)
   - Defer to separate phase - requires significant loop.ts changes
   - Most complex feature with existing skipped tests

## Edge Cases

### TripWire Edge Cases

1. **TripWire in nested workflow:** Should bubble up to parent workflow with stepId context
2. **TripWire in parallel branch:** One branch throws TripWire → whole parallel fails with tripwire status
3. **TripWire serialization:** Must convert TripWire instance to plain object before storage

### Writer Edge Cases

1. **Writer in nested workflow:** Nested steps get their own writer, not parent's writer
2. **Writer after suspend:** Writer not available during resume (step must complete before resuming)
3. **Writer without streaming:** If no outputWriter provided, writer calls are no-ops

### Foreach Index Edge Cases

1. **Resume with invalid index:** Index >= array length → no iteration resumed, loop completes
2. **Resume without index after multi-suspend:** Resumes first suspended (lowest index)
3. **Resume label with foreach:** Label targets step, index disambiguates iteration within that step
4. **Concurrent suspension:** Multiple iterations suspend → metadata stores first suspended index

## Sources

**HIGH confidence** (code inspection):
- `/packages/core/src/workflows/types.ts` - Type definitions for tripwire, foreach params
- `/packages/core/src/workflows/default.ts` - TripWire handling in executeStepWithRetry, fmtReturnValue
- `/packages/core/src/workflows/handlers/step.ts` - Step execution, writer creation
- `/packages/core/src/workflows/handlers/control-flow.ts` - Foreach resume logic
- `/packages/core/src/tools/stream.ts` - ToolStream implementation
- `/packages/core/src/agent/trip-wire.ts` - TripWire class definition

**Test references:**
- `/packages/core/src/workflows/workflow.test.ts` - Agent error tests, general workflow tests
- `/packages/core/src/workflows/__tests__/parallel-writer.test.ts` - Writer in parallel steps
- `/packages/core/src/workflows/evented/evented-workflow.test.ts` lines 18912+ - Foreach resume skipped tests
- `/packages/core/src/tools/tool-stream.test.ts` - Writer custom chunk tests
