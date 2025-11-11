# Mastra Observability - Quick Reference Guide

## Essential File Locations

| File                                               | Lines | Purpose                                 |
| -------------------------------------------------- | ----- | --------------------------------------- |
| `packages/core/src/observability/types/tracing.ts` | 438   | All type definitions                    |
| `packages/core/src/observability/utils.ts`         | 47    | `getOrCreateSpan()` function (CRITICAL) |
| `observability/mastra/src/instances/base.ts`       | 452   | `startSpan()` implementation            |
| `observability/mastra/src/spans/default.ts`        | 187   | TraceId assignment logic                |
| `observability/mastra/src/spans/base.ts`           | 200   | Parent chain walking, export            |
| `observability/mastra/src/exporters/base.ts`       | 162   | Exporter base class                     |
| `observability/mastra/src/exporters/default.ts`    | 661   | Full exporter implementation            |
| `observability/mastra/src/registry.ts`             | 118   | Instance registry                       |

## Key Methods and Line Numbers

### BaseObservabilityInstance (instances/base.ts)

| Method                                | Lines   | Purpose                         |
| ------------------------------------- | ------- | ------------------------------- |
| `startSpan()`                         | 96-134  | Main span creation entry point  |
| `shouldSample()`                      | 235-257 | Sampling decision logic         |
| `computeTraceState()`                 | 262-276 | TraceState creation             |
| `extractMetadataFromRequestContext()` | 281-331 | Metadata extraction             |
| `wireSpanLifecycle()`                 | 198-226 | Add event emission to lifecycle |
| `emitSpanStarted()`                   | 368-375 | Send SPAN_STARTED event         |
| `emitSpanUpdated()`                   | 392-399 | Send SPAN_UPDATED event         |
| `emitSpanEnded()`                     | 380-387 | Send SPAN_ENDED event           |
| `exportTracingEvent()`                | 404-418 | Distribute events to exporters  |

### DefaultSpan (spans/default.ts)

| Method      | Lines   | Purpose                           |
| ----------- | ------- | --------------------------------- |
| Constructor | 16-49   | TraceId assignment, ID generation |
| `end()`     | 51-66   | Set endTime, emit via wrapper     |
| `update()`  | 104-122 | Update attributes/metadata        |
| `error()`   | 68-102  | Record error, optionally end      |

### BaseSpan (spans/base.ts)

| Method              | Lines   | Purpose                            |
| ------------------- | ------- | ---------------------------------- |
| `createChildSpan()` | 121-124 | Create child with parent reference |
| `getParentSpanId()` | 152-161 | Walk parent chain for export       |
| `exportSpan()`      | 178-195 | Convert to ExportedSpan            |

### DefaultExporter (exporters/default.ts)

| Method                  | Lines   | Purpose                    |
| ----------------------- | ------- | -------------------------- |
| `init()`                | 129-156 | Strategy resolution        |
| `_exportTracingEvent()` | 613-636 | Route to strategy handler  |
| `flush()`               | 497-549 | Batch persist with retries |

## Type Hierarchy

```
SpanType (enum, 18 values)
├─ AGENT_RUN → AgentRunAttributes
├─ WORKFLOW_RUN → WorkflowRunAttributes
├─ MODEL_GENERATION → ModelGenerationAttributes
├─ TOOL_CALL → ToolCallAttributes
├─ MCP_TOOL_CALL → MCPToolCallAttributes
└─ ... (13 more types)

Span<TType extends SpanType>
├─ id: string (16 hex)
├─ traceId: string (32 hex)
├─ parent?: AnySpan
├─ type: TType
├─ attributes: SpanTypeMap[TType]
├─ metadata?: Record<string, any>
├─ input?: any
├─ output?: any
├─ errorInfo?: { message, ... }
└─ Methods: end(), update(), error(), createChildSpan(), exportSpan()

ExportedSpan<TType>
└─ Adds: parentSpanId?, isRootSpan (computed)

TracingEvent
├─ SPAN_STARTED
├─ SPAN_UPDATED
└─ SPAN_ENDED
   (each has exportedSpan)
```

## Critical Execution Paths

### Path 1: Root Span Creation (Child = No)

```
getOrCreateSpan(options)
  NO current span
    → instance.startSpan(options)
      → shouldSample() → false? NoOpSpan : continue
      → computeTraceState() OR inherit from parent
      → createSpan() [DefaultSpan instantiation]
        → generateSpanId() [16 hex]
        → traceId = options.traceId OR generateTraceId() [32 hex]
      → wireSpanLifecycle()
      → emitSpanStarted()
        → exportTracingEvent(SPAN_STARTED)
```

### Path 2: Child Span Creation (tracingContext.currentSpan exists)

```
getOrCreateSpan(options, tracingContext: {currentSpan})
  FOUND current span
    → currentSpan.createChildSpan(options)
      → instance.startSpan({...options, parent: this})
        → (same as Path 1, but parent parameter set)
        → DefaultSpan constructor:
          → traceId = parent.traceId [INHERITED]
          → parentSpanId = undefined (not used for children)
```

### Path 3: Span End (Event Emission)

```
agentSpan.end(options)
  [Method was wrapped by wireSpanLifecycle]
  → originalEnd(options)
    → this.endTime = new Date()
    → this.output = options.output
  → emitSpanEnded(this)
    → getSpanForExport()
      → processSpan() [through processors]
      → exportSpan()
    → exportTracingEvent({type: SPAN_ENDED, exportedSpan})
      → for each exporter:
        → exporter.exportTracingEvent(event)
          ├─ DefaultExporter: buffer + flush
          └─ OpenTelemetryBridge: convert + send to collector
```

## Span ID Formats

| ID Type  | Bits | Hex Chars | Example                            |
| -------- | ---- | --------- | ---------------------------------- |
| Span ID  | 64   | 16        | `f8d3a1b2c3d4e5f6`                 |
| Trace ID | 128  | 32        | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

Both generated by:

```typescript
crypto
  .getRandomValues(new Uint8Array(bytes))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

## Metadata Extraction (RequestContext → Span Metadata)

```
TracingOptions.requestContextKeys = ["userId", "sessionId"]
+ Config.requestContextKeys = ["projectId"]
= Merged = ["projectId", "userId", "sessionId"]

For each key:
  requestContext.get(key) → metadata[key]

Supports dot notation:
  "user.id" → requestContext.get("user").id
```

## Event Flow to Exporters

```
1. Span lifecycle triggered (end(), update(), error())
2. Wrapped method calls emit*()
3. emit*() calls exportTracingEvent()
4. exportTracingEvent() creates event:
   {
     type: TracingEventType.SPAN_ENDED,
     exportedSpan: {id, traceId, parentSpanId, ...}
   }
5. Promise.allSettled(
     exporters.map(e => e.exportTracingEvent(event))
   )
6. DefaultExporter: buffer by strategy
7. OpenTelemetryBridge: convert + send to OTEL collector
```

## Three Exporter Strategies

| Strategy           | Events Buffered | Flush Trigger            | Use Case                         |
| ------------------ | --------------- | ------------------------ | -------------------------------- |
| realtime           | None            | Immediate                | Low-latency, small traces        |
| batch-with-updates | All             | Size (1000) or Time (5s) | Default, balanced                |
| insert-only        | SPAN_ENDED only | Size (1000) or Time (5s) | High-throughput, write-optimized |

## Sampling Decisions

| Strategy | Method                        | Result         |
| -------- | ----------------------------- | -------------- |
| ALWAYS   | (none)                        | Sample = true  |
| NEVER    | (none)                        | Sample = false |
| RATIO    | Math.random() < probability   | Stochastic     |
| CUSTOM   | sampler(customSamplerOptions) | User defined   |

If Sample = false → NoOpSpan created (no-op all methods)

## Export Filtering

Span is exported only if:

1. ✓ `span.isValid` = true (not NoOpSpan)
2. ✓ NOT `span.isInternal` OR `config.includeInternalSpans` = true
3. ✓ Passes `spanOutputProcessors` processing

If filtered out → event not sent to exporters

## Configuration Defaults

```typescript
ObservabilityInstanceConfig defaults:
├─ sampling: { type: ALWAYS }
├─ exporters: []
├─ spanOutputProcessors: []
├─ includeInternalSpans: false
└─ requestContextKeys: []
```

## TraceState Computation

```
At root span creation:

TraceState {
  requestContextKeys: [
    ...config.requestContextKeys,
    ...tracingOptions.requestContextKeys
  ]
}

This TraceState is:
├─ Stored on span
├─ Inherited by all child spans
└─ Used to extract metadata from RequestContext
```

## Parent Chain Resolution

```
span.getParentSpanId(includeInternalSpans?)

Walk up parent chain:
├─ If no parent: return this.parentSpanId (for external parents)
├─ If parent.isInternal and !includeInternalSpans:
│   └─ Recurse: parent.getParentSpanId()
└─ Else: return parent.id
```

## NoOpSpan Usage Pattern

```
Created when sampling fails:
├─ All methods are no-ops
├─ No memory allocation for arrays/objects
├─ Immediately eligible for GC
├─ __isNoOp = true
└─ isValid = false → filtered from export

Prevents cost of:
├─ Event emission
├─ Exporter execution
├─ Storage persistence
└─ Metadata extraction
```

## Bridge Implementation Checklist

- [ ] Extend `BaseExporter`
- [ ] Implement `name` property
- [ ] Implement `_exportTracingEvent(event: TracingEvent)`
- [ ] Handle all three event types:
  - [ ] SPAN_STARTED
  - [ ] SPAN_UPDATED
  - [ ] SPAN_ENDED
- [ ] Optional: Override `init(options)`
- [ ] Optional: Override `__setLogger(logger)`
- [ ] Optional: Override `shutdown()`
- [ ] Register in Mastra config `exporters: [...]`
- [ ] Optional: Extract W3C context from RequestContext
- [ ] Optional: Implement `addScoreToTrace()`

## Common Integration Points

### Point 1: Extract W3C Trace Context

**Location**: `getOrCreateSpan()` or `startSpan()`
**Action**: Parse traceparent header from RequestContext

```typescript
const traceparent = requestContext?.get('traceparent');
// Format: "00-traceId-parentSpanId-flags"
```

### Point 2: Inject Into Span Creation

**Location**: Before calling `startSpan()`

```typescript
tracingOptions.traceId = extractedTraceId;
tracingOptions.parentSpanId = extractedParentSpanId;
```

### Point 3: Convert for OTEL Export

**Location**: Bridge's `_exportTracingEvent()`

```typescript
const mastraSpan = event.exportedSpan;
const otelSpan = {
  traceId: mastraSpan.traceId,
  spanId: mastraSpan.id,
  parentSpanId: mastraSpan.parentSpanId,
  name: mastraSpan.name,
  // ... map attributes to semantic conventions
};
```

## Debug Tips

### Check if Span is Valid

```typescript
if (!span.isValid) {
  // NoOpSpan - sampling was disabled
}
```

### Check if Root Span

```typescript
if (span.isRootSpan) {
  // No parent, root of trace
} else {
  // Child span
  const parentId = span.parent?.id;
}
```

### Check if Internal

```typescript
if (span.isInternal) {
  // Workflow/Agent/Model/Tool internal span
  // May be filtered from export
}
```

### Trace Context Flow

```typescript
// Root span creates TraceState
const rootSpan = instance.startSpan({...})
// rootSpan.traceState.requestContextKeys = [...]

// Child spans inherit it
const childSpan = rootSpan.createChildSpan({...})
// childSpan.traceState === rootSpan.traceState
```

## Performance Considerations

1. **Sampling Early**: No-op spans prevent all downstream work
2. **Parent References**: Object references hold parent in memory until context exits
3. **Event Emission**: Promise.allSettled() waits for all exporters
4. **Batch Defaults**: 1000 spans or 5 seconds (tunable)
5. **Memory**: Completed spans cleaned up after flush

## Error Handling

```typescript
// Invalid traceId handling (default.ts:26-33)
if (!isValidTraceId(options.traceId)) {
  console.error("Invalid traceId, generating new")
  this.traceId = generateTraceId()
}

// Exporter errors don't fail other exporters
// (base.ts:404-418)
Promise.allSettled(exporters.map(...))
  // All succeed or fail individually
```

## Testing Entry Points

1. **Span Creation**: DefaultSpan constructor
2. **Event Emission**: wireSpanLifecycle()
3. **Export**: exportTracingEvent()
4. **Batching**: DefaultExporter flush()
5. **Sampling**: shouldSample()
6. **Metadata**: extractMetadataFromRequestContext()
