# Phase 5: Streaming vNext - Research

**Researched:** 2026-01-27
**Domain:** Workflow Streaming API Implementation
**Confidence:** HIGH

## Summary

This research investigates the implementation requirements for adding vNext streaming support to the evented workflow runtime. The evented runtime currently has working `streamLegacy()` support but lacks the modern `stream()` API that returns a `WorkflowRunOutput` object with `.fullStream` and `.result` properties.

The key finding is that **vNext streaming is architecturally feasible** for the evented runtime. The base `Run` class in `workflow.ts` already implements the `stream()` method using the `watch()` pattern, and the evented `EventedRun` class already overrides `watch()` to use the Mastra pubsub. The primary work involves implementing `stream()` and `resumeStream()` methods in `EventedRun` that mirror the base class implementation but use the evented execution model.

**Primary recommendation:** Implement `stream()` and `resumeStream()` methods in `EventedRun` class by adapting the base class's streaming pattern to work with the evented execution engine.

## Standard Stack

### Core Components
| Component | Location | Purpose | Notes |
|-----------|----------|---------|-------|
| `WorkflowRunOutput` | `src/stream/RunOutput.ts` | vNext stream wrapper with `.fullStream`, `.result` | Already exists, can be reused |
| `EventedRun` | `src/workflows/evented/workflow.ts:1115` | Evented runtime Run class | Needs `stream()` method |
| `Run.stream()` | `src/workflows/workflow.ts:2948` | Base vNext streaming impl | Reference implementation |
| `Run.resumeStream()` | `src/workflows/workflow.ts:3082` | Base vNext resume streaming | Reference implementation |

### Supporting Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `EventedRun.watch()` | `evented/workflow.ts:1494` | Event subscription via pubsub |
| `EventedRun.start()` | `evented/workflow.ts:1165` | Execution via EventedExecutionEngine |
| `EventedRun.resume()` | `evented/workflow.ts:1324` | Resume via EventedExecutionEngine |

## Architecture Patterns

### vNext Streaming Pattern (from base Run class)

```typescript
// From workflow.ts:2948-3075
stream({
  inputData,
  closeOnSuspend = true,
  ...
}): WorkflowRunOutput<WorkflowResult> {
  const self = this;

  // Create ReadableStream that pipes watch events
  const stream = new ReadableStream<WorkflowStreamEvent>({
    async start(controller) {
      // Subscribe to events
      const unwatch = self.watch(async (event: any) => {
        // Transform and enqueue events
        controller.enqueue({
          type,
          runId: self.runId,
          from,
          payload: { ... }
        });
      });

      // Start execution
      const executionResultsPromise = self._start({...});

      // Handle completion
      try {
        executionResults = await executionResultsPromise;
        if (closeOnSuspend || executionResults.status !== 'suspended') {
          self.closeStreamAction?.().catch(() => {});
        }
        self.streamOutput?.updateResults(executionResults);
      } catch (err) {
        self.streamOutput?.rejectResults(err);
      }
    },
  });

  // Return WorkflowRunOutput wrapper
  this.streamOutput = new WorkflowRunOutput({
    runId: this.runId,
    workflowId: this.workflowId,
    stream,
  });

  return this.streamOutput;
}
```

### Legacy vs vNext Event Types

| Legacy (streamLegacy) | vNext (stream) |
|-----------------------|----------------|
| `start` | `workflow-start` |
| `step-start` | `workflow-step-start` |
| `step-result` | `workflow-step-result` |
| `step-finish` | `workflow-step-finish` |
| `finish` | `workflow-finish` |

### Key Difference: Return Type

**Legacy:**
```typescript
streamLegacy(): {
  stream: ReadableStream<StreamEvent>;
  getWorkflowState: () => Promise<WorkflowResult>;
}
```

**vNext:**
```typescript
stream(): WorkflowRunOutput<WorkflowResult>
// With properties:
//   .fullStream: ReadableStream<WorkflowStreamEvent>
//   .result: Promise<WorkflowResult>
//   .usage: Promise<LanguageModelUsage>
//   .status: WorkflowRunStatus
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stream wrapper | Custom stream handling | `WorkflowRunOutput` class | Already handles buffering, async iteration, status tracking |
| Event transformation | Manual event mapping | Base `watch()` event format | Already standardized |

## Common Pitfalls

### Pitfall 1: Double Event Prefixing
**What goes wrong:** Events already have `workflow-` prefix from evented runtime but legacy stream strips it
**Why it happens:** `streamLegacy` does `type: event.type.replace('workflow-', '')`
**How to avoid:** vNext stream should NOT strip the prefix, pass events through directly
**Warning signs:** Events show up as `workflow-workflow-step-start`

### Pitfall 2: Result Promise Resolution Timing
**What goes wrong:** `streamOutput.result` resolves before stream finishes or never resolves
**Why it happens:** Evented execution returns from `start()` differently than base runtime
**How to avoid:** Call `streamOutput.updateResults(result)` at the right time in execution flow
**Warning signs:** Tests timing out or result containing stale data

### Pitfall 3: Pubsub vs Local Pubsub
**What goes wrong:** Events don't reach the stream consumer
**Why it happens:** Base Run uses `this.pubsub` (local EventEmitterPubSub), EventedRun uses `this.mastra.pubsub`
**How to avoid:** EventedRun.watch() already correctly uses mastra.pubsub - leverage existing implementation
**Warning signs:** Stream starts but never receives events

### Pitfall 4: closeOnSuspend Handling
**What goes wrong:** Stream closes prematurely or stays open forever
**Why it happens:** Evented runtime suspend/resume flow differs from base runtime
**How to avoid:** Follow pattern from base class: close on complete, optionally close on suspend
**Warning signs:** Cannot resume workflow after suspend, or stream hangs

## Code Examples

### EventedRun.stream() Implementation Pattern
```typescript
// Based on workflow.ts:2948-3075, adapted for EventedRun
stream({
  inputData,
  closeOnSuspend = true,
  perStep,
  ...
}): WorkflowRunOutput<WorkflowResult> {
  if (this.closeStreamAction && this.streamOutput) {
    return this.streamOutput;
  }

  this.closeStreamAction = async () => {};

  const self = this;
  const stream = new ReadableStream<WorkflowStreamEvent>({
    async start(controller) {
      // Use evented watch (uses mastra.pubsub)
      const unwatch = self.watch(async (event: any) => {
        const { type, from = ChunkFrom.WORKFLOW, payload, data, ...rest } = event;
        // Pass through without stripping workflow- prefix
        controller.enqueue({
          type,
          runId: self.runId,
          from,
          payload: {
            stepName: payload?.id,
            ...payload,
          },
        });
      });

      self.closeStreamAction = async () => {
        unwatch();
        try {
          if (controller.desiredSize !== null) {
            controller.close();
          }
        } catch (err) {
          // Log error
        }
      };

      // Use evented start() - key difference from base class
      const executionResultsPromise = self.start({
        inputData,
        perStep,
        // ... other args
      });

      try {
        const executionResults = await executionResultsPromise;
        if (closeOnSuspend || executionResults.status !== 'suspended') {
          self.closeStreamAction?.().catch(() => {});
        }
        self.streamOutput?.updateResults(executionResults);
      } catch (err) {
        self.streamOutput?.rejectResults(err);
        self.closeStreamAction?.().catch(() => {});
      }
    },
  });

  this.streamOutput = new WorkflowRunOutput({
    runId: this.runId,
    workflowId: this.workflowId,
    stream,
  });

  return this.streamOutput;
}
```

## Test Inventory

### Default Runtime Tests (workflow.test.ts)
These tests define the expected vNext behavior:

| Line | Test Name | What It Tests |
|------|-----------|---------------|
| 1433 | should generate a stream | Basic vNext streaming |
| 1572 | should generate a stream for a single step when perStep is true | perStep streaming |
| 1690 | should generate a stream for a single step workflow successfully with state | State handling |
| 1761 | should handle basic suspend and resume flow | suspend/resumeStream |
| 1920 | should handle basic suspend and resume flow that does not close on suspend | closeOnSuspend: false |
| 2064 | should handle custom event emission using writer | Custom events |
| 2172 | should be able to use an agent as a step | Agent streaming |
| 7169 | should handle errors from agent.stream() with full error details | Error propagation |
| 7238 | should preserve error details in streaming workflow | Error in stream |
| 20439 | should return tripwire status when streaming agent in workflow | Tripwire handling |
| 20527 | should handle tripwire from output stream processor | Output tripwire |

### Evented Runtime Tests (evented-workflow.test.ts)
Current state:

| Line | Block | Status | Notes |
|------|-------|--------|-------|
| 28 | Streaming Legacy | PASSING | 5 tests working |
| 808 | Streaming (vNext) | SKIPPED | 6 tests skipped |

### Skipped Tests in Evented Runtime
| Line | Test Name | Gap |
|------|-----------|-----|
| 809 | should generate a stream | Missing stream() method |
| 940 | should generate a stream for a single step when perStep is true | Missing stream() method |
| 1063 | should handle basic suspend and resume flow | Missing resumeStream() method |
| 1209 | should be able to use an agent as a step | Missing stream() method |

## Implementation Feasibility Assessment

### Feasibility: HIGH

**Why:**
1. **watch() already works** - EventedRun already has working watch() that uses mastra.pubsub
2. **start() already works** - EventedRun.start() successfully executes workflows
3. **resume() already works** - EventedRun.resume() handles suspend/resume correctly
4. **Pattern is clear** - Base Run.stream() provides clear reference implementation
5. **WorkflowRunOutput exists** - No need to create new stream wrapper class

### Implementation Complexity: MEDIUM

**Effort areas:**
1. Add stream() method to EventedRun (~80 lines)
2. Add resumeStream() method to EventedRun (~100 lines)
3. Port 6 skipped tests from evented-workflow.test.ts
4. Validate error propagation and tripwire handling

### Architectural Barriers: NONE

Unlike parallel suspend (Phase 4), vNext streaming has no fundamental architectural barriers:
- Streaming is compatible with evented execution model
- Events flow through pubsub which evented already uses
- WorkflowRunOutput can wrap any ReadableStream

## Open Questions

1. **Agent streaming integration** - Should agent.stream() behavior be tested in evented runtime or is that independent?
   - What we know: Agent steps work in evented legacy streaming
   - What's unclear: Full agent streaming events in vNext format
   - Recommendation: Include basic agent streaming test, defer complex cases

2. **Tripwire tests** - Are tripwire tests needed for Phase 5 or separate phase?
   - What we know: Tripwire tests exist in default runtime at lines 20439, 20527
   - What's unclear: Whether evented runtime should support tripwire in this phase
   - Recommendation: Tripwire is agent-specific, may not need evented-specific tests

## Sources

### Primary (HIGH confidence)
- `/packages/core/src/workflows/workflow.ts` - Base Run class implementation
- `/packages/core/src/workflows/evented/workflow.ts` - EventedRun class
- `/packages/core/src/stream/RunOutput.ts` - WorkflowRunOutput implementation
- `/packages/core/src/workflows/workflow.test.ts` - Default runtime streaming tests
- `/packages/core/src/workflows/evented/evented-workflow.test.ts` - Evented runtime tests

### Code References
- Base `stream()`: workflow.ts:2948-3075
- Base `resumeStream()`: workflow.ts:3082-3192
- EventedRun class: evented/workflow.ts:1115-1543
- EventedRun.watch(): evented/workflow.ts:1494-1509
- WorkflowRunOutput: stream/RunOutput.ts:12-465

## Metadata

**Confidence breakdown:**
- Implementation pattern: HIGH - Clear reference in base class
- Test requirements: HIGH - Tests exist and are well-documented
- Effort estimate: HIGH - Pattern is established, copy and adapt

**Research date:** 2026-01-27
**Valid until:** 60 days (stable codebase, no expected changes)
