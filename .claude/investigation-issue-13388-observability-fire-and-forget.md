# Investigation: Inngest Workflows Don't Emit Span Events to User-Configured Exporters

**Issue:** [#13388](https://github.com/mastra-ai/mastra/issues/13388)
**Date:** 2026-02-26 (updated)
**Status:** Root cause confirmed, solution designed — ready for implementation
**Target branch for fix:** `claude/add-notion-folder-bpOd1`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis — Current Codebase](#2-root-cause-analysis--current-codebase)
3. [ObservabilityBus Branch — Current Architecture](#3-observabilitybus-branch--current-architecture)
4. [The Fire-and-Forget Problem on the Bus Branch](#4-the-fire-and-forget-problem-on-the-bus-branch)
5. [Vendor Exporter Audit](#5-vendor-exporter-audit)
6. [Full Impact Matrix](#6-full-impact-matrix)
7. [Recommended Fix](#7-recommended-fix)
8. [Implementation Spec](#8-implementation-spec)

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

## 2. Root Cause Analysis — Current Codebase (main)

### The Fire-and-Forget Chain

The span lifecycle on `main` (`observability/mastra/src/instances/base.ts`) works like this:

```
span.end(options)                              // synchronous
  → emitSpanEnded(span)                        // synchronous void method
    → exportTracingEvent(event).catch(...)     // async promise — DISCARDED
      → target.exportTracingEvent(event)       // actual I/O to each exporter
```

The critical code:

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

The same pattern exists for `emitSpanStarted` and `emitSpanUpdated`.

### Why This Matters for Inngest

In the `InngestExecutionEngine`, span operations happen inside `step.run()` callbacks (the durable execution primitive):

```typescript
// execution-engine.ts, endStepSpan()
async endStepSpan(params) {
    await this.wrapDurableOperation(operationId, async () => {
      span.end(endOptions);
      // span.end() is sync, but it fires exportTracingEvent() as a floating promise
      // step.run() callback completes, Inngest memoizes the result
      // the floating promise may or may not resolve before Inngest tears down the context
    });
  }
```

And in `workflow.ts`, the finalize step:

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

---

## 3. ObservabilityBus Branch — Current Architecture

**Branch:** `claude/add-notion-folder-bpOd1`
**As of commit:** `209142529` ("feat(observability): route all signals to bridge via ObservabilityBus")

The bus branch introduces a unified `ObservabilityBus` for routing all observability signals. The architecture as of the latest commit:

### Key Files

| File | Purpose |
|---|---|
| `observability/mastra/src/bus/base.ts` | `BaseObservabilityEventBus<TEvent>` — generic pub/sub, extends `MastraBase` |
| `observability/mastra/src/bus/observability-bus.ts` | `ObservabilityBus` — routes events to exporters, bridge, auto-extracted metrics, and base subscribers |
| `observability/mastra/src/bus/route-event.ts` | `routeToHandler()` — shared routing function used for both exporters AND bridge |
| `observability/mastra/src/instances/base.ts` | `BaseObservabilityInstance` — orchestrates everything |

### Event Flow (Current)

```
span.end(options)                                     // synchronous
  → emitSpanEnded(span)                               // synchronous void
    → emitTracingEvent(event)                          // synchronous void
      → observabilityBus.emit(event)                   // synchronous void
        ├── routeToHandler(exporter, event)             // for each exporter
        │     └── exporter.exportTracingEvent(event)    // returns Promise — DISCARDED
        ├── routeToHandler(bridge, event)               // for bridge
        │     └── bridge.exportTracingEvent(event)      // returns Promise — DISCARDED
        ├── autoExtractor.processTracingEvent(event)    // sync metric extraction
        └── super.emit(event)                           // base class subscriber delivery
```

### Key Architectural Change: Bridge Now on the Bus

The most recent commit (`209142529`) moved the bridge onto the bus. Previously, the bridge was called separately in `emitTracingEvent()` as a fire-and-forget `bridge.exportTracingEvent(event).catch(...)`. Now:

```typescript
// observability-bus.ts — ObservabilityBus.emit()
emit(event: ObservabilityEvent): void {
    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      routeToHandler(exporter, event, this.logger);
    }

    // Route to bridge (same routing logic as exporters)
    if (this.bridge) {
      routeToHandler(this.bridge, event, this.logger);
    }

    // Auto-extract metrics from tracing, score, and feedback events
    if (this.autoExtractor) { /* ... */ }

    // Deliver to subscribers
    super.emit(event);
  }
```

And in `BaseObservabilityInstance`:

```typescript
// instances/base.ts — emitTracingEvent is now trivial
private emitTracingEvent(event: TracingEvent): void {
    this.observabilityBus.emit(event);
  }
```

The bridge is registered on the bus during construction:

```typescript
// instances/base.ts — constructor
if (this.config.bridge) {
    this.observabilityBus.registerBridge(this.config.bridge);
  }
```

### The `routeToHandler` Shared Utility

Both exporters and the bridge are routed through the same function:

```typescript
// bus/route-event.ts
export function routeToHandler(
  handler: ObservabilityHandler,
  event: ObservabilityEvent,
  logger: IMastraLogger,
): void {
  try {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
      case TracingEventType.SPAN_UPDATED:
      case TracingEventType.SPAN_ENDED: {
        const fn = handler.onTracingEvent
          ? handler.onTracingEvent.bind(handler)
          : handler.exportTracingEvent.bind(handler);
        catchAsyncResult(fn(event as TracingEvent), handler.name, 'tracing', logger);
        break;
      }
      case 'log': /* ... */
      case 'metric': /* ... */
      case 'score': /* ... */
      case 'feedback': /* ... */
    }
  } catch (err) { /* ... */ }
}

function catchAsyncResult(result, handlerName, signal, logger): void {
  if (result && typeof (result as Promise<void>).catch === 'function') {
    (result as Promise<void>).catch(err => {
      logger.error(`[Observability] ${signal} handler error [handler=${handlerName}]:`, err);
    });
  }
}
```

### The `ObservabilityEvents` Interface

Both `ObservabilityExporter` and `ObservabilityBridge` extend `ObservabilityEvents`:

```typescript
// packages/core/src/observability/types/core.ts
export interface ObservabilityEvents {
  onTracingEvent?(event: TracingEvent): void | Promise<void>;
  onLogEvent?(event: LogEvent): void | Promise<void>;
  onMetricEvent?(event: MetricEvent): void | Promise<void>;
  onScoreEvent?(event: ScoreEvent): void | Promise<void>;
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void>;
  exportTracingEvent(event: TracingEvent): Promise<void>;
}
```

---

## 4. The Fire-and-Forget Problem on the Bus Branch

### Where Promises Are Discarded

There are **two layers** of fire-and-forget:

**Layer 1: `routeToHandler()` in `bus/route-event.ts`**

The `catchAsyncResult()` helper catches rejected promises but does not track or return them:

```typescript
function catchAsyncResult(result, handlerName, signal, logger): void {
  if (result && typeof (result as Promise<void>).catch === 'function') {
    (result as Promise<void>).catch(err => { /* logged, not tracked */ });
  }
}
```

This is the primary fire-and-forget site. Both exporter and bridge handler promises are discarded here.

**Layer 2: `BaseObservabilityEventBus.emit()` in `bus/base.ts`**

Generic subscriber promises are also caught and discarded:

```typescript
emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => { /* logged, not tracked */ });
        }
      } catch (err) { /* ... */ }
    }
  }
```

### `flush()` Is a No-Op on the Bus

```typescript
// bus/base.ts
/** No-op — events are dispatched immediately, nothing to flush. Kept for interface compat. */
async flush(): Promise<void> {}
```

The `ObservabilityBus` does not override `flush()` either (it inherits the no-op).

### `flush()` on `BaseObservabilityInstance`

```typescript
// instances/base.ts
async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [this.observabilityBus.flush()];  // no-op!
    flushPromises.push(...this.exporters.map(e => e.flush()));
    if (this.config.bridge) {
      flushPromises.push(this.config.bridge.flush());
    }
    await Promise.allSettled(flushPromises);
  }
```

This only drains exporter/bridge internal buffers. If handler promises from `routeToHandler` haven't resolved, the data hasn't reached those buffers yet, so `exporter.flush()` flushes an empty buffer.

### The Race Condition (OtelBridge Example)

```
emitTracingEvent()
  → bus.emit(event)
    → routeToHandler(bridge, event)
      → bridge.exportTracingEvent(event)       // Promise P1 (DISCARDED by catchAsyncResult)
          → applySpanFormatter(event)           // awaits inside P1
          → _exportTracingEvent(event)          // awaits handleSpanEnded inside P1
            → spanConverter.convertSpan(...)    // awaits inside P1
            → otelSpan.end()                    // sync — adds to OTEL batch
                                                // P1 resolves

--- meanwhile, if flush() is called before P1 resolves ---

flush()
  → observabilityBus.flush()                   // no-op!
  → bridge.flush()
    → provider.forceFlush()                    // drains OTEL batch — but span hasn't arrived yet!
```

---

## 5. Vendor Exporter Audit

### CloudExporter (Mastra Cloud + Mastra Studio/DefaultExporter)

- **Pattern:** Synchronous buffer add in `_exportTracingEvent`, async `flushBuffer()` for batch upload
- **`flush()` implementation:** Drains the internal buffer via `flushBuffer()`
- **Fire-and-forget impact:** MEDIUM. Data enters buffer synchronously once `_exportTracingEvent` starts, but if handler promise hasn't started executing, buffer is empty.

### LangSmith Exporter

- **Pattern:** Extends `TrackingExporter`. Calls `RunTree.postRun()` / `RunTree.patchRun()` — both queue I/O internally in the SDK.
- **`_flush()` implementation:** **NONE.** No override. Base class `_flush` is a no-op.
- **`flush()` behavior:** Inherited from `TrackingExporter` which calls `_flush()` (no-op).
- **Fire-and-forget impact:** HIGH. Even if the handler promise resolves, data sits in the LangSmith SDK's internal queue. This is a **separate bug** that affects serverless/durable environments independently.

### Langfuse Exporter

- **Pattern:** Extends `TrackingExporter`. Uses `Langfuse` client SDK.
- **`_flush()` implementation:** `await this.#client.flushAsync()` — properly flushes.
- **Fire-and-forget impact:** MEDIUM. Has proper `_flush()`, but handler promise must resolve first.

### Datadog Exporter

- **Pattern:** Uses `tracer.llmobs` API.
- **`flush()` implementation:** `await tracer.llmobs.flush()` — properly flushes.
- **Fire-and-forget impact:** MEDIUM.

### Laminar Exporter

- **Pattern:** Uses OTEL `SpanProcessor`.
- **`flush()` implementation:** `await this.processor.forceFlush()` — properly flushes.
- **Fire-and-forget impact:** MEDIUM.

### Sentry Exporter

- **Pattern:** Uses `Sentry` SDK APIs, maintains `spanMap` in memory.
- **`flush()` implementation:** `await Sentry.flush(2000)` — properly flushes.
- **Fire-and-forget impact:** HIGH. Stateful exporter that requires `SPAN_STARTED` before `SPAN_ENDED`. In Inngest's durable execution, `spanMap` is cleared between step invocations. This is a **separate design limitation** — tracked independently.

### OtelBridge

- **Pattern:** Extends `BaseExporter`. Creates OTEL spans and manages `otelSpanMap`.
- **`flush()` implementation:** Calls `provider.forceFlush()` — properly drains the OTEL `BatchSpanProcessor`.
- **Fire-and-forget impact:** MEDIUM. `flush()` is correct if data has reached the processor.

---

## 6. Full Impact Matrix

| Data Path | Fire-and-Forget? | `flush()` Covers It? | Affected By Inngest? |
|---|---|---|---|
| Bus → Exporter `onTracingEvent`/`exportTracingEvent` | YES — via `routeToHandler` → `catchAsyncResult` | NO — bus flush is no-op | YES — `step.run()` may complete before promise resolves |
| Bus → Bridge `exportTracingEvent` | YES — same path as exporters now | NO — bus flush is no-op | YES |
| Bus → Exporter `onLogEvent` | YES — via `routeToHandler` | NO | YES (for any log events in step.run) |
| Bus → Exporter `onMetricEvent` | YES — via `routeToHandler` | NO | YES |
| Bus → Exporter `onScoreEvent` | YES — via `routeToHandler` | NO | YES |
| Bus → Exporter `onFeedbackEvent` | YES — via `routeToHandler` | NO | YES |
| Base class subscribers (`super.emit`) | YES — via `BaseObservabilityEventBus.emit()` | NO | YES |
| LangSmith SDK internal queue | N/A | NO — no `_flush()` override | YES — queue never drained |
| Sentry `spanMap` state | N/A | N/A | YES — state lost between steps (separate issue) |

---

## 7. Recommended Fix

The fix has three parts, all on the `claude/add-notion-folder-bpOd1` branch:

1. **Promise tracking in `routeToHandler` + bus `flush()`** — Track handler promises returned from `routeToHandler()` and base class `emit()`. Make `ObservabilityBus.flush()` and `BaseObservabilityEventBus.flush()` await all pending handler promises.

2. **Two-phase `flush()` in `BaseObservabilityInstance`** — Phase 1: await `observabilityBus.flush()` (which now drains in-flight handler promises for both exporters AND bridge). Phase 2: call `exporter.flush()` + `bridge.flush()` to drain SDK-internal buffers.

3. **Add `observability.flush()` to Inngest workflow finalize** — Call `await observability.flush()` **outside** `step.run()` in `workflow.ts` after the finalize step. This ensures all export promises resolve and exporter buffers drain before the Inngest function completes.

4. **(Optional, separate PR)** Fix LangSmith exporter missing `_flush()` override.

### Why This Approach

- Since the bridge is now routed through the same `routeToHandler()` as exporters, **one fix location** (promise tracking in `routeToHandler`) covers both exporters and bridge.
- `emit()` stays synchronous — no change to calling code.
- `flush()` becomes meaningful — one call drains everything.
- Works for all durable engines, not just Inngest.
- All event types (tracing, log, metric, score, feedback) get the fix for free.

---

## 8. Implementation Spec

This section is designed to be directly actionable by an implementing agent working on `claude/add-notion-folder-bpOd1`.

### 8.1 — Track Promises in `routeToHandler`

**File: `observability/mastra/src/bus/route-event.ts`**

The `routeToHandler` function currently discards handler promises via `catchAsyncResult`. Change it to **return** the promise (if any) so callers can track it.

**Current signature:**
```typescript
export function routeToHandler(handler: ObservabilityHandler, event: ObservabilityEvent, logger: IMastraLogger): void
```

**New signature:**
```typescript
export function routeToHandler(handler: ObservabilityHandler, event: ObservabilityEvent, logger: IMastraLogger): void | Promise<void>
```

**Change `catchAsyncResult` to return the caught promise instead of discarding it:**

```typescript
/** Catch rejected promises from async handlers, and return the tracked promise for flush(). */
function catchAsyncResult(
  result: void | Promise<void>,
  handlerName: string,
  signal: string,
  logger: IMastraLogger,
): void | Promise<void> {
  if (result && typeof (result as Promise<void>).catch === 'function') {
    return (result as Promise<void>).catch(err => {
      logger.error(`[Observability] ${signal} handler error [handler=${handlerName}]:`, err);
    });
  }
  return undefined;
}
```

**And update `routeToHandler` to return the result of `catchAsyncResult` instead of discarding it.** Each `case` that calls `catchAsyncResult` should propagate its return:

```typescript
export function routeToHandler(
  handler: ObservabilityHandler,
  event: ObservabilityEvent,
  logger: IMastraLogger,
): void | Promise<void> {
  try {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
      case TracingEventType.SPAN_UPDATED:
      case TracingEventType.SPAN_ENDED: {
        const fn = handler.onTracingEvent
          ? handler.onTracingEvent.bind(handler)
          : handler.exportTracingEvent.bind(handler);
        return catchAsyncResult(fn(event as TracingEvent), handler.name, 'tracing', logger);
      }
      case 'log':
        if (handler.onLogEvent) {
          return catchAsyncResult(handler.onLogEvent(event as LogEvent), handler.name, 'log', logger);
        }
        break;
      case 'metric':
        if (handler.onMetricEvent) {
          return catchAsyncResult(handler.onMetricEvent(event as MetricEvent), handler.name, 'metric', logger);
        }
        break;
      case 'score':
        if (handler.onScoreEvent) {
          return catchAsyncResult(handler.onScoreEvent(event as ScoreEvent), handler.name, 'score', logger);
        }
        break;
      case 'feedback':
        if (handler.onFeedbackEvent) {
          return catchAsyncResult(handler.onFeedbackEvent(event as FeedbackEvent), handler.name, 'feedback', logger);
        }
        break;
    }
  } catch (err) {
    logger.error(`[Observability] Handler error [handler=${handler.name}]:`, err);
  }
}
```

### 8.2 — Add Promise Tracking to `ObservabilityBus`

**File: `observability/mastra/src/bus/observability-bus.ts`**

Add a `pendingHandlers` set and track promises returned by `routeToHandler`. Override `flush()` to drain them.

```typescript
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private bridge?: ObservabilityBridge;
  private autoExtractor?: AutoExtractedMetrics;

  // NEW: Track in-flight handler promises for flush()
  private pendingHandlers: Set<Promise<void>> = new Set();

  // ... existing constructor, registerExporter, etc. ...

  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler on each registered exporter
    for (const exporter of this.exporters) {
      this.trackPromise(routeToHandler(exporter, event, this.logger));
    }

    // Route to bridge (same routing logic as exporters)
    if (this.bridge) {
      this.trackPromise(routeToHandler(this.bridge, event, this.logger));
    }

    // Auto-extract metrics (unchanged — these are synchronous)
    if (this.autoExtractor) {
      /* ... existing autoExtractor logic unchanged ... */
    }

    // Deliver to subscribers (base class)
    super.emit(event);
  }

  /**
   * Track an async handler promise so flush() can await it.
   * No-ops for sync (void) results.
   */
  private trackPromise(result: void | Promise<void>): void {
    if (result && typeof (result as Promise<void>).then === 'function') {
      const promise = result as Promise<void>;
      this.pendingHandlers.add(promise);
      promise.finally(() => this.pendingHandlers.delete(promise));
    }
  }

  /**
   * Await all in-flight handler delivery promises.
   * This ensures all event data has been delivered to exporters and bridge
   * before their internal buffers are flushed.
   */
  async flush(): Promise<void> {
    if (this.pendingHandlers.size > 0) {
      await Promise.allSettled([...this.pendingHandlers]);
    }
  }

  // existing shutdown() should call flush() before clearing:
  async shutdown(): Promise<void> {
    await this.flush();
    // ... existing cleanup ...
  }
}
```

### 8.3 — Add Promise Tracking to `BaseObservabilityEventBus`

**File: `observability/mastra/src/bus/base.ts`**

Same pattern for generic subscribers:

```typescript
export class BaseObservabilityEventBus<TEvent> extends MastraBase implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();

  // NEW: Track in-flight subscriber handler promises
  private pendingSubscriberHandlers: Set<Promise<void>> = new Set();

  emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          const promise = (result as Promise<void>).catch(err => {
            this.logger.error('[ObservabilityEventBus] Handler error:', err);
          });
          this.pendingSubscriberHandlers.add(promise);
          promise.finally(() => this.pendingSubscriberHandlers.delete(promise));
        }
      } catch (err) {
        this.logger.error('[ObservabilityEventBus] Handler error:', err);
      }
    }
  }

  // ... existing subscribe() ...

  /** Await all in-flight subscriber handler promises. */
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

### 8.4 — Two-Phase `flush()` in `BaseObservabilityInstance`

**File: `observability/mastra/src/instances/base.ts`**

The current `flush()` calls `observabilityBus.flush()` (currently a no-op), then `exporter.flush()` + `bridge.flush()` in parallel. After implementing 8.2/8.3, `observabilityBus.flush()` now actually drains handler promises. But we need **two phases** — first await handler delivery, then flush exporter/bridge internal buffers.

**Replace the current `flush()` with:**

```typescript
async flush(): Promise<void> {
    this.logger.debug(`[Observability] Flush started [name=${this.name}]`);

    // Phase 1: Await in-flight handler delivery promises.
    // This ensures all event data has been delivered to exporters and bridge
    // internal buffers before we attempt to flush those buffers.
    await this.observabilityBus.flush();

    // Phase 2: Drain exporter and bridge internal buffers.
    // Now that data has been delivered, flushing will capture everything.
    const bufferFlushPromises: Promise<void>[] = [...this.exporters.map(e => e.flush())];
    if (this.config.bridge) {
      bufferFlushPromises.push(this.config.bridge.flush());
    }

    const results = await Promise.allSettled(bufferFlushPromises);

    // Log any errors but don't throw
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const targetName = index < this.exporters.length ? this.exporters[index]?.name : 'bridge';
        this.logger.error(`[Observability] Flush error [target=${targetName}]`, result.reason);
      }
    });

    this.logger.debug(`[Observability] Flush completed [name=${this.name}]`);
  }
```

**Key difference from current code:** Phase 1 (`observabilityBus.flush()`) is now awaited **before** Phase 2 starts. They are **not** run in parallel. This is critical — if run in parallel, `exporter.flush()` may still drain an empty buffer.

### 8.5 — Add `observability.flush()` to Inngest Workflow

**File: `workflows/inngest/src/workflow.ts`**

After the finalize `step.run()` completes, add a flush call **outside** the step so it's not memoized:

```typescript
// Inside getFunction(), after the finalize step.run() (around line 432):

await step.run(`workflow.${this.id}.finalize`, async () => {
    // ...existing finalize logic (unchanged)...
});

// Flush observability OUTSIDE step.run so it executes on every invocation
// (not memoized) and ensures all span export promises have resolved
const observability = mastra?.observability?.getSelectedInstance({ requestContext });
if (observability) {
    await observability.flush();
}

return { result, runId };
```

**Why outside `step.run()`:**
1. Flush is idempotent — safe to run on every replay
2. It must not be memoized — we need it to actually execute every time
3. It doesn't produce state that needs to be durable
4. It's I/O without a return value, which Inngest allows outside steps

### 8.6 — Tests

#### Bus Promise Tracking Tests

**File: `observability/mastra/src/bus/observability-bus.test.ts`** (add to existing tests)

```typescript
describe('flush()', () => {
  it('should await pending async handler promises before resolving', async () => {
    const bus = new ObservabilityBus();
    const exportOrder: string[] = [];

    // Create a slow async exporter
    const slowExporter = {
      name: 'slow',
      exportTracingEvent: async (event: TracingEvent) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        exportOrder.push('slow-done');
      },
      flush: async () => {},
      shutdown: async () => {},
    } as ObservabilityExporter;

    bus.registerExporter(slowExporter);

    // Emit an event (fire-and-forget internally)
    const event: TracingEvent = {
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: { /* minimal test span */ } as any,
    };
    bus.emit(event);

    // Before flush, handler may not have completed
    expect(exportOrder).not.toContain('slow-done');

    // After flush, handler must have completed
    await bus.flush();
    expect(exportOrder).toContain('slow-done');
  });

  it('should await bridge handler promises', async () => {
    const bus = new ObservabilityBus();
    let bridgeDone = false;

    const bridge = {
      name: 'test-bridge',
      exportTracingEvent: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        bridgeDone = true;
      },
      createSpan: () => undefined,
      flush: async () => {},
      shutdown: async () => {},
    } as unknown as ObservabilityBridge;

    bus.registerBridge(bridge);

    bus.emit({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: {} as any,
    });

    await bus.flush();
    expect(bridgeDone).toBe(true);
  });
});
```

#### Base EventBus Promise Tracking Tests

**File: `observability/mastra/src/bus/base.test.ts`** (add to existing tests)

```typescript
describe('flush()', () => {
  it('should await pending async subscriber promises', async () => {
    const bus = new BaseObservabilityEventBus({ name: 'test' });
    let handlerDone = false;

    bus.subscribe(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      handlerDone = true;
    });

    bus.emit({} as any);
    expect(handlerDone).toBe(false);

    await bus.flush();
    expect(handlerDone).toBe(true);
  });
});
```

#### Two-Phase Flush Integration Test

**File: `observability/mastra/src/integration-tests.test.ts`** (add to existing tests)

Test that `BaseObservabilityInstance.flush()` ensures handler delivery completes before exporter buffer flush:

```typescript
it('flush() should deliver events before draining exporter buffers', async () => {
  const deliveryOrder: string[] = [];

  // Create a test exporter whose exportTracingEvent is async
  const testExporter = {
    name: 'test',
    exportTracingEvent: async (event) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      deliveryOrder.push('handler-delivered');
    },
    flush: async () => {
      deliveryOrder.push('buffer-flushed');
    },
    shutdown: async () => {},
  };

  // ... create observability instance with testExporter ...
  // ... emit a span ...

  await observability.flush();

  // handler-delivered MUST come before buffer-flushed
  expect(deliveryOrder).toEqual(['handler-delivered', 'buffer-flushed']);
});
```

### 8.7 — (Optional, Separate PR) Fix LangSmith Exporter

**File: `observability/langsmith/src/tracing.ts`**

Add a `_flush()` override that drains the LangSmith SDK's internal queue. The exact method depends on the LangSmith JS SDK version — check `langsmith` npm package for `Client.prototype.flush()` or `Client.prototype.awaitPendingTraceBatches()`.

---

## Appendix: Code References (Bus Branch as of 2091425)

| File | Description |
|---|---|
| `observability/mastra/src/bus/base.ts` | `BaseObservabilityEventBus.emit()` — fire-and-forget subscriber dispatch; `flush()` — no-op |
| `observability/mastra/src/bus/observability-bus.ts` | `ObservabilityBus.emit()` — routes to exporters + bridge + auto-metrics + subscribers; no `flush()` override |
| `observability/mastra/src/bus/route-event.ts` | `routeToHandler()` — shared routing for exporters AND bridge; `catchAsyncResult()` — discards promises |
| `observability/mastra/src/instances/base.ts` | `emitTracingEvent()` — now just calls `bus.emit()`; `flush()` — calls bus.flush() (no-op) + exporter/bridge flush in parallel |
| `observability/otel-bridge/src/bridge.ts` | `_exportTracingEvent()` — async OTEL span handling; `flush()` — calls `provider.forceFlush()` |
| `observability/langsmith/src/tracing.ts` | No `_flush()` override — LangSmith SDK queue never drained |
| `observability/langfuse/src/tracing.ts` | `_flush()` — properly calls `flushAsync()` |
| `workflows/inngest/src/execution-engine.ts` | `endStepSpan()` — `span.end()` inside `wrapDurableOperation` / `step.run()` |
| `workflows/inngest/src/workflow.ts` | Finalize step — `span.end()` fire-and-forget inside `step.run()`; no flush after finalize |
