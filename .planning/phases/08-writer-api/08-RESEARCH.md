# Phase 8: Writer API - Research

**Researched:** 2026-01-27
**Domain:** Workflow step context API - ToolStream integration
**Confidence:** HIGH

## Summary

Phase 8 implements writer API support in the evented runtime's step context. This is **implementation parity work** - the API is already fully defined by the default runtime at `packages/core/src/tools/stream.ts` and extensively tested in default runtime tests.

The writer API exposes a `ToolStream` instance in step execution context, allowing steps to emit custom events during execution via `writer.write()` and `writer.custom()`. The default runtime creates ToolStream instances with an OutputWriter callback that publishes to the pubsub channel `workflow.events.v2.{runId}`. The evented runtime needs to follow the same pattern.

**Primary recommendation:** Create ToolStream instances in StepExecutor with OutputWriter that publishes to `this.mastra.pubsub` on channel `workflow.events.v2.{runId}`, replacing the 4 TODOs with actual writer instances. Pattern is identical across all 4 call sites (execute, evaluateCondition, resolveSleep, resolveSleepUntil).

## Standard Stack

The writer API uses existing framework components - no new dependencies required.

### Core Components
| Component | Location | Purpose | Role |
|-----------|----------|---------|------|
| ToolStream | packages/core/src/tools/stream.ts | WritableStream wrapper with write/custom methods | Already implemented, just needs instantiation |
| OutputWriter | packages/core/src/workflows/types.ts | Function type for writing chunks | Callback that publishes to pubsub |
| PubSub | packages/core/src/events/pubsub.ts | Event bus interface | Transport for writer events |
| EventEmitterPubSub | packages/core/src/events/event-emitter.ts | PubSub implementation | Used by evented runtime |

### No Installation Required
All components exist in the codebase. This is plumbing work, not new functionality.

## Architecture Patterns

### Pattern 1: ToolStream Creation (Default Runtime)
**What:** Create ToolStream with metadata and OutputWriter callback
**When to use:** When constructing step context parameters
**Example:**
```typescript
// Source: packages/core/src/workflows/handlers/step.ts:389-397
writer: new ToolStream(
  {
    prefix: 'workflow-step',
    callId: stepCallId,
    name: step.id,
    runId,
  },
  outputWriter,
)
```

### Pattern 2: OutputWriter Callback (Inngest Runtime)
**What:** OutputWriter publishes to pubsub channel workflow.events.v2.{runId}
**When to use:** When passing outputWriter to engine.execute()
**Example:**
```typescript
// Source: workflows/inngest/src/workflow.ts:306-316
outputWriter: async (chunk: WorkflowStreamEvent) => {
  try {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: chunk,
    });
  } catch (err) {
    this.logger.debug?.('Failed to publish watch event:', err);
  }
}
```

### Pattern 3: Writer Usage in Step Code
**What:** Step execute functions call writer.write() or writer.custom()
**When to use:** When step needs to emit events during execution
**Example:**
```typescript
// Source: packages/core/src/workflows/__tests__/writer-custom-bubbling.test.ts:19-28
execute: async ({ inputData, writer }) => {
  await writer?.write({
    type: 'custom-status',
    data: { customMessage: 'NORMAL_STEP_WRITE' },
  });
  await writer?.custom({
    type: 'custom-status',
    data: { customMessage: 'NORMAL_STEP_CUSTOM' },
  });
  return { context: `${inputData.context}-step` };
}
```

### Pattern 4: Evented Runtime Pubsub Access
**What:** StepExecutor has access to mastra.pubsub for publishing
**When to use:** In evented runtime's StepExecutor when creating OutputWriter
**Example:**
```typescript
// Source: packages/core/src/workflows/evented/step-executor.ts:154
[PUBSUB_SYMBOL]: this.mastra?.pubsub ?? new EventEmitterPubSub(params.emitter)
```

### Anti-Patterns to Avoid
- **Passing undefined writer:** Don't use `writer: undefined as any` - breaks step code that expects ToolStream API
- **Wrong pubsub channel:** Must use `workflow.events.v2.{runId}` not generic `workflows` channel
- **Missing metadata:** ToolStream requires prefix, callId, name, runId - all are available at call sites
- **Forgetting all 4 call sites:** StepExecutor has 4 methods that create context (execute, evaluateCondition, resolveSleep, resolveSleepUntil)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event emission from steps | Custom event writer | ToolStream class | Already handles WritableStream interface, prefix management, payload formatting |
| Pubsub publishing | Direct pubsub calls in steps | OutputWriter callback | Decouples step code from pubsub implementation |
| Event metadata | Manual metadata construction | ToolStream constructor params | Automatically formats events with correct prefix, callId, name |

**Key insight:** The entire writer API is already implemented and tested. This phase is purely plumbing - connecting existing components that are already proven to work.

## Common Pitfalls

### Pitfall 1: Forgetting EventEmitter Fallback
**What goes wrong:** StepExecutor.execute gets EventEmitter from params, but other methods (evaluateCondition, resolveSleep, resolveSleepUntil) create local EventEmitter instances
**Why it happens:** Different methods have different parameter signatures
**How to avoid:** Use the pattern from line 154 (execute) vs line 344 (evaluateCondition) - create local ee when needed
**Warning signs:** Test failures in conditional/sleep steps with writer usage

### Pitfall 2: Missing callId Generation
**What goes wrong:** ToolStream requires callId but not all call sites have it
**Why it happens:** Only execute() method generates stepCallId with randomUUID()
**How to avoid:** Generate unique callId in each method that creates writer (evaluateCondition, resolveSleep, resolveSleepUntil)
**Warning signs:** Type errors about missing callId parameter

### Pitfall 3: Wrong Event Channel
**What goes wrong:** Events published to wrong channel aren't picked up by stream subscriptions
**Why it happens:** Evented runtime uses multiple channels (workflows, workflows-finish, workflow.events.v2.{runId})
**How to avoid:** OutputWriter must publish to `workflow.events.v2.{runId}` - this is the watch channel (see workflow.ts:1802)
**Warning signs:** Tests expecting workflow-step-output events don't receive them

### Pitfall 4: Incomplete Implementation
**What goes wrong:** Writer works in execute() but not in conditions/sleep
**Why it happens:** Forgetting that all 4 methods create ExecuteFunctionParams with writer
**How to avoid:** Search for `writer: undefined as any` - exactly 4 occurrences at lines 150, 340, 415, 490
**Warning signs:** Some tests pass but others fail with "writer is undefined"

## Code Examples

Verified patterns from the codebase:

### Creating ToolStream with OutputWriter (Evented Runtime Pattern)
```typescript
// Source: Adapted from step-executor.ts structure and default runtime pattern
import { ToolStream } from '../../tools/stream';
import { randomUUID } from 'node:crypto';

// In StepExecutor.execute method:
const stepCallId = randomUUID();
const outputWriter = async (chunk: any) => {
  if (this.mastra?.pubsub) {
    await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: chunk,
    });
  }
};

const writer = new ToolStream(
  {
    prefix: 'workflow-step',
    callId: stepCallId,
    name: step.id,
    runId,
  },
  outputWriter,
);
```

### writer.write() Event Format
```typescript
// Source: packages/core/src/tools/stream.ts:44-63
// ToolStream._write() formats events as:
{
  type: 'workflow-step-output',
  runId: runId,
  from: 'USER',
  payload: {
    output: data,  // The data passed to writer.write()
    runId: runId,
    stepName: step.id,
  }
}
```

### writer.custom() Event Format
```typescript
// Source: packages/core/src/tools/stream.ts:70-74
// ToolStream.custom() passes data directly:
{
  type: 'custom-status',  // User-defined type
  data: { customMessage: 'NORMAL_STEP_CUSTOM' }  // User-defined data
}
```

### Complete StepExecutor.execute Implementation Pattern
```typescript
// Source: Combining patterns from step-executor.ts:95-167 and handlers/step.ts:389-397
async execute(params: { /* ... */ }): Promise<StepResult<any, any, any, any>> {
  const { step, runId } = params;
  const stepCallId = randomUUID();

  const outputWriter = async (chunk: any) => {
    if (this.mastra?.pubsub) {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: chunk,
      });
    }
  };

  const stepOutput = await step.execute(
    createDeprecationProxy(
      {
        // ... other context fields ...
        writer: new ToolStream(
          {
            prefix: 'workflow-step',
            callId: stepCallId,
            name: step.id,
            runId,
          },
          outputWriter,
        ),
        // ... rest of context ...
      },
      { /* deprecation config */ },
    ),
  );

  // ... rest of method ...
}
```

## State of the Art

| Component | Status | Notes |
|-----------|--------|-------|
| ToolStream class | Stable since default runtime implementation | No changes needed |
| writer API in step context | Standard API, defined in ExecuteFunctionParams | Type is non-optional: `writer: ToolStream` |
| Pubsub event channel | Established pattern | `workflow.events.v2.{runId}` is the watch channel |
| Event format | Stable | write() uses workflow-step-output, custom() passes through |

**No deprecated/outdated patterns:** This is new implementation, not migration.

## Open Questions

None. This is implementation parity work with a clear reference implementation.

**What we know:**
- Default runtime pattern at packages/core/src/workflows/handlers/step.ts:389-397
- Inngest runtime pattern at workflows/inngest/src/workflow.ts:306-316
- Event channel at packages/core/src/workflows/evented/workflow.ts:1802
- ToolStream API at packages/core/src/tools/stream.ts

**Implementation checklist:**
1. Generate unique callId in each method (use randomUUID from node:crypto)
2. Create outputWriter callback that publishes to `workflow.events.v2.{runId}`
3. Instantiate ToolStream with prefix='workflow-step', callId, name=step.id, runId
4. Replace `writer: undefined as any` with writer instance
5. Repeat for all 4 methods: execute, evaluateCondition, resolveSleep, resolveSleepUntil

## Sources

### Primary (HIGH confidence)
- packages/core/src/tools/stream.ts - ToolStream implementation
- packages/core/src/workflows/handlers/step.ts:389-397 - Default runtime pattern
- packages/core/src/workflows/evented/step-executor.ts:150,340,415,490 - TODOs to replace
- packages/core/src/workflows/evented/evented-workflow.test.ts:1851,1938 - Expected behavior
- packages/core/src/workflows/types.ts:20 - OutputWriter type definition
- packages/core/src/workflows/step.ts:55 - writer in ExecuteFunctionParams type
- workflows/inngest/src/workflow.ts:306-316 - Inngest runtime reference

### Secondary (MEDIUM confidence)
- packages/core/src/workflows/__tests__/parallel-writer.test.ts - Usage patterns
- packages/core/src/workflows/__tests__/writer-custom-bubbling.test.ts - Event format examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist in codebase, no external dependencies
- Architecture: HIGH - Reference implementations in default and Inngest runtimes
- Pitfalls: HIGH - Clear from TODO comments and skipped test descriptions

**Research date:** 2026-01-27
**Valid until:** 90 days (stable internal API, no external dependencies)
