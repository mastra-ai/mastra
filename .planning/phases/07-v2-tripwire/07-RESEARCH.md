# Phase 7: V2 Model + TripWire Support - Research

**Researched:** 2026-01-27
**Domain:** Agent step V2 model detection and TripWire error propagation
**Confidence:** HIGH (verified against default runtime codebase)

## Summary

This research documents how the default runtime implements V2 model detection and TripWire error handling. The evented runtime must match these patterns exactly for parity.

The default runtime uses `isSupportedLanguageModel()` to detect V2+ models (specificationVersion `v2` or `v3`) and branches to either `.stream()` or `.streamLegacy()` accordingly. TripWire errors thrown from output processors are caught in `executeStepWithRetry()`, serialized with explicit type markers (reason, retry, metadata, processorId), and propagated to the workflow result with a `tripwire` status instead of `failed`.

**Primary recommendation:** The evented workflow `createStepFromAgent` function must be updated to detect V2 models and use `.stream()` instead of `.streamLegacy()`, and the `StepExecutor` must catch TripWire errors and serialize them with the same structure as the default runtime.

## Standard Stack

The required components for V2 model and TripWire support:

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `isSupportedLanguageModel` | `agent/utils.ts` | Detect V2+ models | Single source of truth for model version checking |
| `supportedLanguageModelSpecifications` | `agent/utils.ts` | List of supported versions (`['v2', 'v3']`) | Centralized version list |
| `TripWire` | `agent/trip-wire.ts` | Custom Error class for processor aborts | Standard tripwire error type |
| `StepTripwireInfo` | `workflows/types.ts` | Serialized tripwire data structure | Type-safe tripwire serialization |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `getErrorFromUnknown` | `error/utils.ts` | Convert unknown errors to MastraError | Error serialization in step executor |
| `MastraModelOutput` | `stream/` | V2 model stream output wrapper | When streaming from V2 models |

## Architecture Patterns

### Pattern 1: V2 Model Detection and Branching

**What:** The default runtime detects V2+ models via `isSupportedLanguageModel()` and uses different streaming methods.

**When to use:** Whenever an agent step needs to stream responses.

**Example from `agent.ts:3424-3442`:**
```typescript
// Source: packages/core/src/agent/agent.ts
const modelInfo = llm.getModel();

if (!isSupportedLanguageModel(modelInfo)) {
  const modelId = modelInfo.modelId || 'unknown';
  const provider = modelInfo.provider || 'unknown';

  throw new MastraError({
    id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with stream(). Please use AI SDK v5+ models or call the streamLegacy() method instead.`,
    details: {
      agentName: this.name,
      modelId,
      provider,
      specificationVersion: modelInfo.specificationVersion,
    },
  });
}

// V2+ model detected, use .stream()
const result = await this.#execute(executeOptions);
```

**Key insight:** The default runtime throws an error for V1 models when `.stream()` is called. The evented runtime should similarly branch based on model version.

### Pattern 2: TripWire Catching and Serialization

**What:** TripWire errors thrown from output processors are caught in `executeStepWithRetry()` and converted to a plain object with explicit type markers.

**When to use:** In step execution error handling.

**Example from `default.ts:446-462`:**
```typescript
// Source: packages/core/src/workflows/default.ts
return {
  ok: false,
  error: {
    status: 'failed',
    error: errorInstance,
    endedAt: Date.now(),
    // Preserve TripWire data as plain object for proper serialization
    tripwire:
      e instanceof TripWire
        ? {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          }
        : undefined,
  },
};
```

### Pattern 3: TripWire Status Propagation to Workflow Result

**What:** When a step fails due to TripWire, the workflow result uses `tripwire` status instead of `failed`.

**When to use:** When formatting workflow results.

**Example from `default.ts:498-518`:**
```typescript
// Source: packages/core/src/workflows/default.ts
if (lastOutput.status === 'failed') {
  // Check if the failure was due to a TripWire
  const tripwireData = lastOutput?.tripwire;
  if (tripwireData instanceof TripWire) {
    // Use 'tripwire' status instead of 'failed' for tripwire errors (TripWire instance)
    base.status = 'tripwire';
    base.tripwire = {
      reason: tripwireData.message,
      retry: tripwireData.options?.retry,
      metadata: tripwireData.options?.metadata,
      processorId: tripwireData.processorId,
    };
  } else if (tripwireData && typeof tripwireData === 'object' && 'reason' in tripwireData) {
    // Use 'tripwire' status for plain tripwire data objects (already serialized)
    base.status = 'tripwire';
    base.tripwire = tripwireData;
  } else {
    base.error = this.formatResultError(error, lastOutput);
  }
}
```

### Current Evented Workflow Agent Step Implementation

**Location:** `workflows/evented/workflow.ts:327-393`

**Current behavior (lines 347-356):**
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

**Key observation:** The evented workflow always uses `.streamLegacy()` regardless of model version. This needs to be updated to detect V2+ models and use `.stream()` instead.

### Anti-Patterns to Avoid

- **Always using streamLegacy:** The current evented workflow ignores model version and always uses legacy streaming.
- **Losing TripWire prototype chain:** When errors cross event boundaries (pubsub), class instances lose their prototype. Must serialize TripWire data as plain objects.
- **Missing tripwire field in step results:** When catching TripWire errors, the tripwire data must be preserved on the step result for later propagation.

## Don't Hand-Roll

Problems that have existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| V2 model detection | Custom version check | `isSupportedLanguageModel()` | Centralized, maintained, includes v3 |
| TripWire serialization | Custom serialization | Explicit `{ reason, retry, metadata, processorId }` structure | Matches default runtime exactly |
| Error conversion | Direct instanceof checks | `getErrorFromUnknown()` | Handles edge cases, serialization |
| Supported versions list | Hardcoded versions | `supportedLanguageModelSpecifications` constant | Single source of truth |

**Key insight:** The default runtime's TripWire handling is well-defined. Copy the exact patterns, don't improvise.

## Common Pitfalls

### Pitfall 1: Prototype Chain Loss Across Event Boundaries

**What goes wrong:** When TripWire instances are sent through pubsub events, they lose their prototype chain and become plain objects. `instanceof TripWire` checks fail.

**Why it happens:** JSON serialization (or structured clone) strips class prototypes. The evented workflow uses pubsub for step results.

**How to avoid:** Always serialize TripWire data to plain objects before crossing event boundaries. Use duck-typing (`'reason' in tripwireData`) for detection instead of `instanceof`.

**Warning signs:** `instanceof TripWire` returning false for tripwire errors after pubsub events.

### Pitfall 2: Missing TripWire Data in Step Result

**What goes wrong:** TripWire is caught but its data isn't preserved on the step result, so the workflow result can't propagate tripwire status.

**Why it happens:** Catching the error but not extracting TripWire-specific fields.

**How to avoid:** When catching errors, always check `e instanceof TripWire` and extract `{ reason: e.message, retry: e.options?.retry, metadata: e.options?.metadata, processorId: e.processorId }` to the step result.

**Warning signs:** Workflow result shows `failed` status instead of `tripwire` when output processor rejects.

### Pitfall 3: Using streamLegacy() for V2 Models

**What goes wrong:** V2 models may have features that only work with `.stream()`, and using `.streamLegacy()` means losing access to structured output, tripwire chunks, etc.

**Why it happens:** Not detecting model version before choosing streaming method.

**How to avoid:** Check `isSupportedLanguageModel(llm.getModel())` before streaming. Use `.stream()` for V2+, `.streamLegacy()` only for V1.

**Warning signs:** V2 model features not working, tripwire chunks not being processed.

## Code Examples

### V2 Model Detection

```typescript
// Source: packages/core/src/agent/utils.ts
import { isSupportedLanguageModel } from '../agent/utils';

const llm = await agent.getLLM({ requestContext });
const modelInfo = llm.getModel();

if (isSupportedLanguageModel(modelInfo)) {
  // V2+ model - use .stream()
  const result = await agent.stream(prompt, options);
} else {
  // V1 model - use .streamLegacy()
  const { fullStream } = await agent.streamLegacy(prompt, options);
}
```

### TripWire Error Handling in Step Executor

```typescript
// Pattern from default.ts executeStepWithRetry
import { TripWire } from '../agent/trip-wire';
import { getErrorFromUnknown } from '../error/utils';

try {
  const output = await step.execute(context);
  return { status: 'success', output, endedAt: Date.now() };
} catch (e: any) {
  const errorInstance = getErrorFromUnknown(e, {
    serializeStack: false,
    fallbackMessage: 'Unknown step execution error',
  });

  return {
    status: 'failed',
    error: errorInstance,
    endedAt: Date.now(),
    // Preserve TripWire data as plain object
    tripwire:
      e instanceof TripWire
        ? {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          }
        : undefined,
  };
}
```

### TripWire Status in Workflow Result

```typescript
// Pattern from execution-engine.ts fmtReturnValue
const tripwireData = lastOutput?.tripwire;

if (lastOutput.status === 'failed' && tripwireData) {
  // Check both TripWire instance and plain object (after serialization)
  if (tripwireData instanceof TripWire) {
    base.status = 'tripwire';
    base.tripwire = {
      reason: tripwireData.message,
      retry: tripwireData.options?.retry,
      metadata: tripwireData.options?.metadata,
      processorId: tripwireData.processorId,
    };
  } else if (typeof tripwireData === 'object' && 'reason' in tripwireData) {
    // Already serialized (came through pubsub)
    base.status = 'tripwire';
    base.tripwire = tripwireData;
  }
}
```

## State of the Art

| Component | Current State | Notes |
|-----------|---------------|-------|
| V2 model support | Fully implemented in default runtime | Agent.stream() requires V2+ |
| TripWire class | Stable, with retry/metadata options | Used by processors to abort |
| tripwire workflow status | Added to WorkflowRunStatus type | Distinct from 'failed' |
| Evented workflow agent step | Uses streamLegacy() only | Needs V2 branching |

## Open Questions

No open questions - the default runtime implementation is clear and well-documented.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/agent/utils.ts` - isSupportedLanguageModel implementation
- `packages/core/src/agent/agent.ts` - V2 model detection in stream()
- `packages/core/src/workflows/default.ts` - TripWire handling in executeStepWithRetry and fmtReturnValue
- `packages/core/src/agent/trip-wire.ts` - TripWire class definition
- `packages/core/src/workflows/types.ts` - StepTripwireInfo and WorkflowRunStatus types
- `packages/core/src/workflows/evented/workflow.ts` - Current agent step implementation

### Secondary (MEDIUM confidence)
- `packages/core/src/workflows/handlers/step.ts` - Default runtime step execution

## Metadata

**Confidence breakdown:**
- V2 model detection: HIGH - Direct code analysis of default runtime
- TripWire serialization: HIGH - Direct code analysis with exact patterns
- Status propagation: HIGH - Clear code paths in fmtReturnValue

**Research date:** 2026-01-27
**Valid until:** 60 days (stable patterns, unlikely to change)
