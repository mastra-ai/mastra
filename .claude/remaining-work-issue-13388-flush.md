# Remaining Work: Issue #13388 — Observability Fire-and-Forget Fix

**Issue:** [#13388](https://github.com/mastra-ai/mastra/issues/13388)
**Date:** 2026-02-26
**Status:** `@mastra/observability` changes complete — remaining work is in other packages

---

## What's Done (`@mastra/observability`)

Promise tracking and two-phase flush are fully implemented:

1. **`routeToHandler()`** now returns `void | Promise<void>` instead of discarding handler promises
2. **`BaseObservabilityEventBus`** tracks async subscriber promises in a self-cleaning `pendingSubscribers` set; `flush()` awaits them; `shutdown()` flushes before clearing
3. **`ObservabilityBus`** tracks handler promises from `routeToHandler()` in a `pendingHandlers` set; `flush()` awaits handlers then delegates to `super.flush()` for subscribers
4. **`BaseObservabilityInstance.flush()`** is now two-phase: Phase 1 awaits `bus.flush()` (drains delivery promises), then Phase 2 calls `exporter.flush()` + `bridge.flush()` (drains SDK-internal buffers) — sequential, not parallel

---

## Remaining Work (Other Packages)

### 1. Add `observability.flush()` to Inngest Workflow Finalize

**Package:** `@mastra/inngest` (`workflows/inngest/src/workflow.ts`)

After the finalize `step.run()` completes, add a flush call **outside** the step so it executes on every invocation (not memoized by Inngest):

```typescript
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

**Important:** Verify the exact location and variable scope in `workflow.ts`. The `observability` instance needs to be accessible at the point where the flush is added. Check how `mastra` and `requestContext` are available in `getFunction()`.

### 2. Fix LangSmith Exporter Missing `_flush()` (Separate PR)

**Package:** `@mastra/langsmith` (`observability/langsmith/src/tracing.ts`)

The LangSmith exporter extends `TrackingExporter` but does not override `_flush()`. This means `flush()` is a no-op — the LangSmith SDK's internal queue is never drained, even when `flush()` is called.

This is a **separate bug** that affects all environments (not just Inngest), but is most visible in serverless/durable contexts.

**Fix:** Add a `_flush()` override that drains the LangSmith SDK's internal queue. Check the `langsmith` npm package for `Client.prototype.flush()` or `Client.prototype.awaitPendingTraceBatches()`.

### 3. Sentry Exporter Stateful Span Limitation (Separate Issue)

**Package:** `@mastra/sentry` (`observability/sentry/`)

The Sentry exporter maintains a `spanMap` in memory that requires `SPAN_STARTED` before `SPAN_ENDED`. In Inngest's durable execution model, `spanMap` is cleared between step invocations because the process may be recycled. This is a **design limitation** specific to stateful exporters in durable execution environments.

This requires a different approach (e.g., persisting span state in durable storage) and should be tracked as a separate issue.

---

## Verification

After implementing the Inngest flush change:

1. Configure an exporter (e.g., `OtelExporter` or `JsonExporter`)
2. Run an Inngest-based workflow
3. Verify that span events appear in the exporter output
4. Verify that `flush()` completes before the Inngest function returns
