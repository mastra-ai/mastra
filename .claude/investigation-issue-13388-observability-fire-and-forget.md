# Investigation: Inngest Workflows Don't Emit Span Events to User-Configured Exporters

**Issue:** [#13388](https://github.com/mastra-ai/mastra/issues/13388)
**Date:** 2026-02-25
**Status:** Root cause confirmed, solution designed

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis — Current Codebase](#2-root-cause-analysis--current-codebase)
3. [The ObservabilityBus Branch Analysis](#3-the-observabilitybus-branch-analysis)
4. [Bridge Data Path Analysis](#4-bridge-data-path-analysis)
5. [Vendor Exporter Audit](#5-vendor-exporter-audit)
6. [Full Impact Matrix](#6-full-impact-matrix)
7. [Solution Options](#7-solution-options)
8. [Recommended Fix](#8-recommended-fix)
9. [Implementation Plan](#9-implementation-plan)

---

## 1. Problem Statement

User-configured observability exporters (e.g., `OtelExporter`, `SentryExporter`, `LangSmithExporter`, custom `BaseExporter` subclasses) **never receive `exportTracingEvent` calls** for Inngest-based workflows. Non-Inngest workflows work correctly — spans appear in both Mastra Studio and external exporters.

### Environment

- `@mastra/core`: 1.3.0
- `@mastra/observability`: 1.2.0
- `@mastra/inngest`: 1.1.0

### Reporter Observations

1. Exporter `init()` and `__setLogger()` are called during startup (exporter is properly registered).
2. `exportTracingEvent` monkey-patch confirms calls happen for non-Inngest workflows.
3. Mastra Studio's `DefaultExporter` also shows **zero traces** from Inngest workflows.
4. Stateful exporters like `SentryExporter` have an additional problem: their `spanMap` requires `SPAN_STARTED` before `SPAN_ENDED`, and Inngest's durable execution replays clear in-memory state between step invocations.

---

## 2. Root Cause Analysis — Current Codebase

### The Fire-and-Forget Chain

The span lifecycle in the current codebase (`observability/mastra/src/instances/base.ts`) works like this:

```
span.end(options)                              // synchronous
  → emitSpanEnded(span)                        // synchronous void method
    → exportTracingEvent(event).catch(...)     // async promise — DISCARDED
      → target.exportTracingEvent(event)       // actual I/O to each exporter
```

The critical code at lines 482-488:

```typescript
protected emitSpanEnded(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      this.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan }).catch(error => {
        this.logger.error('[Observability] Failed to export span_ended event', error);
      });
      // ^^^ Promise is caught but NEVER awaited. Fire-and-forget.
    }
  }
```

The same pattern exists for `emitSpanStarted` (line 473) and `emitSpanUpdated` (line 497).

### Why This Matters for Inngest

In the `InngestExecutionEngine`, span operations happen inside `step.run()` callbacks (the durable execution primitive):

```typescript
// execution-engine.ts, line 299
async endStepSpan(params) {
    await this.wrapDurableOperation(operationId, async () => {
      span.end(endOptions);
      // span.end() is sync, but it fires exportTracingEvent() as a floating promise
      // step.run() callback completes, Inngest memoizes the result
      // the floating promise may or may not resolve before Inngest tears down the context
    });
  }
```

And in `workflow.ts`, the finalize step (lines 325-432):

```typescript
await step.run(`workflow.${this.id}.finalize`, async () => {
    // ...lifecycle callbacks...

    if (workflowSpanData) {
      const workflowSpan = observability.rebuildSpan(workflowSpanData);
      workflowSpan.end({ output: result.result, attributes: { status: result.status } });
      // ^^^ span.end() fires exportTracingEvent as fire-and-forget
      // step.run() callback returns, Inngest memoizes
      // floating promise is abandoned
    }

    // ...snapshot persistence, publish events...
});
```

**In Inngest's execution model**, once a `step.run()` callback returns, Inngest records the memoized result and may interrupt the function for replay. Floating promises (I/O that hasn't been awaited) are unreliable — they may be garbage collected, the process may be recycled, or Inngest may move to the next step before they complete.

### Why Non-Inngest Workflows Work

In `DefaultExecutionEngine`, spans are not wrapped in `step.run()`. The fire-and-forget promises float in the same long-lived Node.js process and reliably complete via the event loop. The process doesn't get interrupted between steps.

### The `flush()` Gap

Even if someone called `observability.flush()` after the workflow completes, the current `flush()` implementation (lines 555-577) only calls `exporter.flush()` and `bridge.flush()`:

```typescript
async flush(): Promise<void> {
    const flushPromises = [...this.exporters.map(e => e.flush())];
    if (this.config.bridge) {
      flushPromises.push(this.config.bridge.flush());
    }
    await Promise.allSettled(flushPromises);
  }
```

This drains exporter-internal buffers (e.g., `CloudExporter`'s batch buffer), but it does **not** await the floating promises from `emitSpanStarted/Ended/Updated`. If those promises haven't resolved, the data hasn't reached the exporter's buffer yet, so `exporter.flush()` flushes an empty buffer.

---

## 3. The ObservabilityBus Branch Analysis

Branch: `claude/add-notion-folder-bpOd1`

This branch introduces a new `ObservabilityBus` event-based system to handle observability events beyond just span start/end/update (logs, metrics, scores, feedback). The architecture:

```
ObservabilityBus (extends BaseObservabilityEventBus)
  ├── Routes events to registered exporters via handler methods
  │   (onTracingEvent, onLogEvent, onMetricEvent, onScoreEvent, onFeedbackEvent)
  ├── Runs auto-extracted metrics from tracing events
  └── Delivers to generic subscribers via base class
```

### The Same Fire-and-Forget Pattern Persists

**`BaseObservabilityEventBus.emit()`** (bus/base.ts):

```typescript
emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => {
            console.error('[ObservabilityEventBus] Handler error:', err);
          });
        }
      } catch (err) {
        console.error('[ObservabilityEventBus] Handler error:', err);
      }
    }
  }
```

Promise caught, not tracked. Same pattern.

**`ObservabilityBus.routeToHandler()`** (bus/observability-bus.ts):

```typescript
private routeToHandler(exporter: ObservabilityExporter, event: ObservabilityEvent): void {
    try {
      switch (event.type) {
        case TracingEventType.SPAN_STARTED:
        case TracingEventType.SPAN_UPDATED:
        case TracingEventType.SPAN_ENDED: {
          const handler = exporter.onTracingEvent
            ? exporter.onTracingEvent.bind(exporter)
            : exporter.exportTracingEvent.bind(exporter);
          const result = handler(event as TracingEvent);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(err => {
              console.error(`[ObservabilityBus] Tracing handler error [exporter=${exporter.name}]:`, err);
            });
          }
          break;
        }
        // Same pattern for 'log', 'metric', 'score', 'feedback'...
```

Every event type: promise caught, not tracked. Fire-and-forget.

**`BaseObservabilityEventBus.flush()`** is explicitly a no-op:

```typescript
/** No-op — events are dispatched immediately, nothing to flush. Kept for interface compat. */
async flush(): Promise<void> {}
```

The buffer removal commit (4d632f6a4) documents this philosophy:

> "Buffering/batching is intentionally NOT done here — individual exporters own their own batching strategy (e.g. CloudExporter batches uploads internally)."

### New `emitTracingEvent()` Method

The bus branch replaced the direct `exportTracingEvent().catch()` calls with a new private method:

```typescript
// instances/base.ts on the bus branch
private emitTracingEvent(event: TracingEvent): void {
    // Route through the bus for exporter delivery + auto-extracted metrics
    this.observabilityBus.emit(event);   // synchronous, fire-and-forget internally

    // Export to bridge directly (bridge is not registered on the bus)
    if (this.config.bridge) {
      this.config.bridge.exportTracingEvent(event).catch(error => {
        this.logger.error(`[Observability] Bridge export error [bridge=${this.config.bridge!.name}]`, error);
      });
      // ^^^ ALSO fire-and-forget
    }
  }
```

And the emit methods now call this:

```typescript
protected emitSpanEnded(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = { type: TracingEventType.SPAN_ENDED, exportedSpan };
      this.emitTracingEvent(event);   // void, no promise at all
    }
  }
```

**The bus branch has the same fundamental problem as the current code.** The architecture changed (event bus + handler routing instead of direct `exportTracingEvent` calls), but the promise handling didn't. In fact, it's slightly more indirect — the current code at least has a `Promise<void>` return from `exportTracingEvent()` that _could_ be awaited; the bus branch's `emit()` is fully `void`.

### The `flush()` on the Bus Branch

```typescript
// instances/base.ts on the bus branch
async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [this.observabilityBus.flush()];  // no-op!
    flushPromises.push(...this.exporters.map(e => e.flush()));
    if (this.config.bridge) {
      flushPromises.push(this.config.bridge.flush());
    }
    await Promise.allSettled(flushPromises);
  }
```

`this.observabilityBus.flush()` is a no-op. So `flush()` only drains exporter/bridge internal buffers — same gap as the current code.

---

## 4. Bridge Data Path Analysis

The bridge (`OtelBridge`) is called in a separate fire-and-forget path from the bus:

```
emitTracingEvent(event)
  ├── observabilityBus.emit(event)                    → exporters via bus (fire-and-forget)
  └── bridge.exportTracingEvent(event).catch(...)     → bridge (fire-and-forget)
```

### OtelBridge Internals

`OtelBridge` extends `BaseExporter` and implements `_exportTracingEvent`:

```typescript
// otel-bridge/src/bridge.ts
protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type === TracingEventType.SPAN_ENDED) {
      await this.handleSpanEnded(event);
    }
  }
```

`handleSpanEnded` does:
1. Look up the OTEL span from `otelSpanMap` (created at span start via `createSpan()`)
2. Use `SpanConverter` to convert Mastra span → OTEL span format (async — awaits)
3. Set attributes, status, events on the OTEL span
4. Call `otelSpan.end()` — this is an OTEL SDK call that adds the span to the `BatchSpanProcessor` buffer

### The Race Condition

```
emitTracingEvent()
  → bridge.exportTracingEvent(event).catch(...)   // Promise P1 (fire-and-forget)
      → applySpanFormatter(event)                  // awaits
      → _exportTracingEvent(event)                 // awaits handleSpanEnded
        → spanConverter.convertSpan(...)           // awaits
        → otelSpan.end()                           // sync — adds to OTEL batch
                                                   // P1 resolves

--- meanwhile ---

flush()
  → bridge.flush()
    → provider.forceFlush()                        // drains OTEL batch
```

If `flush()` runs before P1 resolves (before `otelSpan.end()` executes), the span isn't in the OTEL `BatchSpanProcessor` buffer yet and `forceFlush()` misses it.

### OtelBridge flush() Implementation

```typescript
async flush(): Promise<void> {
    const provider = otelTrace.getTracerProvider();
    if (provider && 'forceFlush' in provider && typeof provider.forceFlush === 'function') {
      await provider.forceFlush();
    }
  }
```

This is correct for draining the OTEL batch processor — but only if the data has reached the batch processor. The fire-and-forget call means data may not have arrived yet.

---

## 5. Vendor Exporter Audit

### CloudExporter (Mastra Cloud + Mastra Studio/DefaultExporter)

- **Pattern:** Synchronous buffer add in `_exportTracingEvent`, async `flushBuffer()` for batch upload
- **`flush()` implementation:** Drains the internal buffer via `flushBuffer()`
- **Fire-and-forget impact:** MEDIUM. The `addToBuffer()` call is synchronous inside the async `_exportTracingEvent`. If the handler promise from the bus resolves far enough to enter `_exportTracingEvent`, the data enters the buffer synchronously. But if the bus's fire-and-forget promise hasn't even started executing `_exportTracingEvent` yet, the buffer is empty.
- **Secondary issue:** Inside `_exportTracingEvent`, `flush()` is called as fire-and-forget when `shouldFlush()` returns true:
  ```typescript
  this.flush().catch(error => { ... });
  ```

### LangSmith Exporter

- **Pattern:** Extends `TrackingExporter`. Calls `RunTree.postRun()` (LangSmith SDK) and `RunTree.patchRun()` — both queue I/O internally in the SDK.
- **`_flush()` implementation:** **NONE.** No override. Base class `_flush` is a no-op.
- **`flush()` behavior:** Inherited from `TrackingExporter` which calls `_flush()` (no-op).
- **Fire-and-forget impact:** HIGH. Even if the handler promise resolves, data sits in the LangSmith SDK's internal queue with no way to flush it. This is a **separate bug** — the LangSmith exporter needs a `_flush()` that calls the LangSmith `Client`'s flush method.

### Langfuse Exporter

- **Pattern:** Extends `TrackingExporter`. Uses `Langfuse` client SDK.
- **`_flush()` implementation:** `await this.#client.flushAsync()` — properly flushes the Langfuse SDK.
- **Has realtime mode:** In realtime mode, also calls `flushAsync()` in `_postExportTracingEvent()`.
- **Fire-and-forget impact:** MEDIUM. Has proper `_flush()`, but the handler promise must resolve first for data to reach the SDK.

### Datadog Exporter

- **Pattern:** Uses `tracer.llmobs` API.
- **`flush()` implementation:** `await tracer.llmobs.flush()` — properly flushes.
- **Fire-and-forget impact:** MEDIUM. Same dependency on handler promise resolution.

### Laminar Exporter

- **Pattern:** Uses OTEL `SpanProcessor`.
- **`flush()` implementation:** `await this.processor.forceFlush()` — properly flushes.
- **Fire-and-forget impact:** MEDIUM. Same dependency.

### Sentry Exporter

- **Pattern:** Uses `Sentry` SDK APIs, maintains `spanMap` in memory.
- **`flush()` implementation:** `await Sentry.flush(2000)` — properly flushes.
- **Fire-and-forget impact:** HIGH. Stateful exporter that requires `SPAN_STARTED` before `SPAN_ENDED`. In Inngest's durable execution, the `spanMap` is cleared between step invocations. Even if fire-and-forget was fixed, the statefulness problem remains for durable engines. The reporter specifically called this out.

### PostHog Exporter

- **Pattern:** Uses PostHog Analytics SDK.
- **`flush()` implementation:** Not visible in quick scan, but likely delegates to SDK.
- **Fire-and-forget impact:** MEDIUM.

### Arize / Braintrust Exporters

- **Pattern:** Appear to be stubs on the bus branch (minimal code).
- **Fire-and-forget impact:** Unknown until implemented.

---

## 6. Full Impact Matrix

| Data Path | Fire-and-Forget? | `flush()` Covers It? | Affected By Inngest? |
|---|---|---|---|
| Bus → Exporter `onTracingEvent` | YES — promise caught, not tracked | NO — bus flush is no-op | YES — step.run() may complete before promise resolves |
| Bus → Exporter `onLogEvent` | YES | NO | YES (for any log events in step.run) |
| Bus → Exporter `onMetricEvent` | YES | NO | YES (for any metric events in step.run) |
| Bus → Exporter `onScoreEvent` | YES | NO | YES |
| Bus → Exporter `onFeedbackEvent` | YES | NO | YES |
| Bridge `exportTracingEvent` | YES — promise caught, not tracked | NO — bridge flush only drains SDK buffer | YES |
| CloudExporter internal `flush()` | YES — called fire-and-forget inside `_exportTracingEvent` | Partially — external `flush()` call drains buffer | YES |
| LangSmith SDK queue | N/A — data reaches SDK via handler | NO — no `_flush()` override | YES — SDK queue not flushed |
| Sentry `spanMap` state | N/A | N/A | YES — state lost between Inngest steps (separate bug) |

---

## 7. Solution Options

### Option A: Minimal Fix in `@mastra/inngest` Only

**Approach:** Explicitly call and await `exportTracingEvent` after `span.end()` inside `step.run()` callbacks, and call `observability.flush()` in the finalize step.

**Pros:**
- Smallest change surface
- No observability architecture changes needed
- Can ship quickly

**Cons:**
- Duplicates export logic in the Inngest engine
- Doesn't fix the underlying fire-and-forget problem for other durable engines
- `flush()` still doesn't await in-flight promises — only drains buffers
- Every new durable engine needs the same workaround

### Option B: Make `span.end()` Return an Awaitable Promise

**Approach:** Change `span.end()` to return `Promise<void>` (or return the export promise). Callers that need durability can await it.

**Pros:**
- Clean API — callers opt in to awaiting
- Backwards compatible (existing callers ignore the return value)

**Cons:**
- Changes the `span.end()` signature across the codebase
- On the bus branch, `emit()` is `void` by design — would need to change the bus interface
- Doesn't address the `flush()` gap

### Option C: Track Promises in the Bus + Fix `flush()`

**Approach:** The `ObservabilityBus` tracks promises returned by async handlers and its `flush()` awaits them before draining exporter buffers. The bridge promise is tracked separately in `BaseObservabilityInstance`.

**Pros:**
- Fixes the problem at the architecture level — all event types covered automatically
- `emit()` stays synchronous — no change to calling code
- `flush()` becomes meaningful — one call drains everything
- Works for all durable engines, not just Inngest
- New event types (log, metric, score, feedback) get the fix for free

**Cons:**
- Requires changes on the bus branch
- The `Set<Promise>` tracking has a small overhead (promise creation + `finally` cleanup)

### Option D: Option C + Fix Vendor Exporters

**Approach:** Option C, plus audit and fix vendor exporters that lack proper `_flush()` implementations.

**Pros:**
- Complete fix — no data loss path remains
- LangSmith, PostHog, and other exporters properly flush their SDK queues

**Cons:**
- Larger change surface
- Requires knowledge of each vendor SDK's flush API

### Option E: Option C + D + Add `observability.flush()` to Inngest Finalize

**Approach:** The full solution. Fix the bus, fix vendor exporters, and add a single `await observability.flush()` call in the Inngest workflow finalize step (outside `step.run()` so it's not memoized).

---

## 8. Recommended Fix

**Option E — the full solution.** Here's why:

1. **Option C alone is necessary but not sufficient.** The bus fix ensures `flush()` awaits in-flight handler promises, but someone still needs to _call_ `flush()`. In Inngest workflows, the natural place is after the finalize step.

2. **Option D is needed for completeness.** The LangSmith exporter has no `_flush()` at all. Even with perfect promise tracking, data sits in the LangSmith SDK queue with no way to drain it. This is a real bug that affects non-Inngest scenarios too (e.g., serverless environments where the process is recycled).

3. **The bus branch is the right place to fix this.** The bus already sees every handler return value and already distinguishes sync from async. Adding promise tracking is a natural extension, not a hack.

4. **The fix ordering matters.** `flush()` must:
   - First: await all in-flight handler delivery promises (bus + bridge)
   - Then: drain exporter/bridge internal buffers (`exporter.flush()`, `bridge.flush()`)

   Without step 1, step 2 may flush empty buffers.

### What About Sentry's Statefulness?

The `SentryExporter` has a separate problem: it maintains a `spanMap` that requires `SPAN_STARTED` before `SPAN_ENDED`. In Inngest's durable execution, in-memory state is lost between step invocations. This is a **design limitation of stateful exporters in durable contexts**, not a fire-and-forget problem. Possible solutions:

- Sentry could use the `TrackingExporter` base class which handles out-of-order span arrival
- Or Sentry could be documented as incompatible with durable engines
- Or a storage-backed span map could be used

This is a separate issue and should be tracked independently.

---

## 9. Implementation Plan

### Phase 1: Fix the ObservabilityBus (on `claude/add-notion-folder-bpOd1`)

**File: `observability/mastra/src/bus/observability-bus.ts`**

Add promise tracking to `routeToHandler()`:

```typescript
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private autoExtractor?: AutoExtractedMetrics;
  private pendingHandlers: Set<Promise<void>> = new Set();

  // ... existing methods ...

  private routeToHandler(exporter: ObservabilityExporter, event: ObservabilityEvent): void {
    try {
      let result: void | Promise<void>;

      switch (event.type) {
        case TracingEventType.SPAN_STARTED:
        case TracingEventType.SPAN_UPDATED:
        case TracingEventType.SPAN_ENDED: {
          const handler = exporter.onTracingEvent
            ? exporter.onTracingEvent.bind(exporter)
            : exporter.exportTracingEvent.bind(exporter);
          result = handler(event as TracingEvent);
          break;
        }
        case 'log':
          result = exporter.onLogEvent?.(event as LogEvent);
          break;
        case 'metric':
          result = exporter.onMetricEvent?.(event as MetricEvent);
          break;
        case 'score':
          result = exporter.onScoreEvent?.(event as ScoreEvent);
          break;
        case 'feedback':
          result = exporter.onFeedbackEvent?.(event as FeedbackEvent);
          break;
      }

      // Track async handler promises for flush()
      if (result && typeof (result as Promise<void>).then === 'function') {
        const tracked = (result as Promise<void>).catch(err => {
          console.error(`[ObservabilityBus] Handler error [exporter=${exporter.name}]:`, err);
        });
        this.pendingHandlers.add(tracked);
        tracked.finally(() => this.pendingHandlers.delete(tracked));
      }
    } catch (err) {
      console.error(`[ObservabilityBus] Sync handler error [exporter=${exporter.name}]:`, err);
    }
  }

  /**
   * Await all in-flight handler promises.
   * Call this before draining exporter buffers to ensure data has been delivered.
   */
  async flush(): Promise<void> {
    if (this.pendingHandlers.size > 0) {
      await Promise.allSettled([...this.pendingHandlers]);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.exporters = [];
    // Also clear base class subscribers
    super.shutdown();
  }
}
```

**File: `observability/mastra/src/bus/base.ts`**

Same pattern for generic subscribers:

```typescript
export class BaseObservabilityEventBus<TEvent> implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();
  private pendingSubscriberHandlers: Set<Promise<void>> = new Set();

  emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          const tracked = (result as Promise<void>).catch(err => {
            console.error('[ObservabilityEventBus] Handler error:', err);
          });
          this.pendingSubscriberHandlers.add(tracked);
          tracked.finally(() => this.pendingSubscriberHandlers.delete(tracked));
        }
      } catch (err) {
        console.error('[ObservabilityEventBus] Handler error:', err);
      }
    }
  }

  async flush(): Promise<void> {
    if (this.pendingSubscriberHandlers.size > 0) {
      await Promise.allSettled([...this.pendingSubscriberHandlers]);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.subscribers.clear();
  }
}
```

### Phase 2: Track Bridge Promises in BaseObservabilityInstance

**File: `observability/mastra/src/instances/base.ts`**

```typescript
export class BaseObservabilityInstance implements ObservabilityInstance {
  // ... existing fields ...
  private pendingBridgeExports: Set<Promise<void>> = new Set();

  private emitTracingEvent(event: TracingEvent): void {
    this.observabilityBus.emit(event);

    if (this.config.bridge) {
      const p = this.config.bridge.exportTracingEvent(event).catch(error => {
        this.logger.error(`[Observability] Bridge export error [bridge=${this.config.bridge!.name}]`, error);
      });
      this.pendingBridgeExports.add(p);
      p.finally(() => this.pendingBridgeExports.delete(p));
    }
  }

  async flush(): Promise<void> {
    this.logger.debug(`[Observability] Flush started [name=${this.name}]`);

    // Phase 1: Await in-flight handler delivery promises
    // This ensures data has reached exporter/bridge internal buffers
    const deliveryPromises: Promise<void>[] = [this.observabilityBus.flush()];
    if (this.pendingBridgeExports.size > 0) {
      deliveryPromises.push(Promise.allSettled([...this.pendingBridgeExports]).then(() => {}));
    }
    await Promise.allSettled(deliveryPromises);

    // Phase 2: Drain exporter and bridge internal buffers
    // Now that data has been delivered, flush the buffers
    const bufferFlushPromises = [...this.exporters.map(e => e.flush())];
    if (this.config.bridge) {
      bufferFlushPromises.push(this.config.bridge.flush());
    }
    const results = await Promise.allSettled(bufferFlushPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const targetName = index < this.exporters.length ? this.exporters[index]?.name : 'bridge';
        this.logger.error(`[Observability] Flush error [target=${targetName}]`, result.reason);
      }
    });

    this.logger.debug(`[Observability] Flush completed [name=${this.name}]`);
  }
}
```

### Phase 3: Fix Vendor Exporters

**LangSmith** (`observability/langsmith/src/tracing.ts`):

```typescript
protected override async _flush(): Promise<void> {
    // The LangSmith Client has an internal batch queue.
    // Calling awaitPendingTraceBatches() ensures all queued runs are sent.
    if (this.#client) {
      await this.#client.awaitPendingTraceBatches();
    }
  }
```

> Note: The exact LangSmith SDK method may be `awaitPendingTraceBatches()`, `flush()`, or similar — needs verification against the SDK docs.

**Other exporters** (Langfuse, Datadog, Laminar, Sentry) already have proper `_flush()` or `flush()` implementations.

### Phase 4: Add `observability.flush()` to Inngest Workflow

**File: `workflows/inngest/src/workflow.ts`**

After the finalize `step.run()`, add a flush call **outside** the step so it's not memoized:

```typescript
// Inside getFunction(), after the finalize step.run():

await step.run(`workflow.${this.id}.finalize`, async () => {
    // ...existing finalize logic...
});

// Flush observability OUTSIDE step.run so it executes on every invocation
// (not memoized) and ensures all span export promises have resolved
const observability = mastra?.observability?.getSelectedInstance({ requestContext });
if (observability) {
    await observability.flush();
}

return { result, runId };
```

> **Important:** This must be outside `step.run()` because:
> 1. Flush is idempotent — safe to run on every replay
> 2. It must not be memoized — we need it to actually execute
> 3. It doesn't produce state that needs to be durable

### Phase 5: Tests

1. **Bus promise tracking test:** Emit events with async handlers, verify `flush()` awaits them
2. **Bridge promise tracking test:** Verify bridge export promises are tracked and flushed
3. **Integration test:** Inngest workflow with a test exporter that records `exportTracingEvent` calls, verify spans are received after `flush()`
4. **LangSmith flush test:** Verify `_flush()` drains the SDK queue

---

## Appendix: Code References

### Current Codebase (development branch)

| File | Key Lines | Description |
|---|---|---|
| `observability/mastra/src/instances/base.ts` | 470-501 | `emitSpanStarted/Ended/Updated` — fire-and-forget |
| `observability/mastra/src/instances/base.ts` | 506-529 | `exportTracingEvent` — the async method whose promise is discarded |
| `observability/mastra/src/instances/base.ts` | 555-577 | `flush()` — only drains exporter buffers, doesn't await delivery |
| `workflows/inngest/src/execution-engine.ts` | 288-302 | `endStepSpan` — `span.end()` inside `wrapDurableOperation` |
| `workflows/inngest/src/workflow.ts` | 325-432 | Finalize step — `span.end()` fire-and-forget inside `step.run()` |

### ObservabilityBus Branch (`claude/add-notion-folder-bpOd1`)

| File | Key Lines | Description |
|---|---|---|
| `observability/mastra/src/bus/base.ts` | 18-35 | `BaseObservabilityEventBus.emit()` — fire-and-forget |
| `observability/mastra/src/bus/base.ts` | 45 | `flush()` — explicit no-op |
| `observability/mastra/src/bus/observability-bus.ts` | 100-175 | `routeToHandler()` — fire-and-forget for all event types |
| `observability/mastra/src/instances/base.ts` | 667-676 | `emitTracingEvent()` — bus emit + bridge fire-and-forget |
| `observability/mastra/src/instances/base.ts` | 735-765 | `flush()` — calls bus.flush() (no-op) + exporter.flush() |
| `observability/otel-bridge/src/bridge.ts` | 83-90 | `_exportTracingEvent` — async OTEL span handling |
| `observability/otel-bridge/src/bridge.ts` | 247-258 | `flush()` — calls OTEL provider.forceFlush() |
| `observability/langsmith/src/tracing.ts` | entire file | No `_flush()` override — SDK queue never drained |
| `observability/langfuse/src/tracing.ts` | 371-374 | `_flush()` — properly calls `flushAsync()` |
