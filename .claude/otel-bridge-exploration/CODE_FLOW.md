# Mastra Observability - Code Flow and Integration Guide

## 1. Key Code Locations Quick Reference

### Type Definitions

```
packages/core/src/observability/types/tracing.ts
├── SpanType enum (lines 17-50)
├── ObservabilityInstance interface (lines 438-473)
├── Span<T> interface (lines 349-393)
├── ExportedSpan<T> interface (lines 407-412)
├── TracingEvent type (lines 790-793)
├── ObservabilityExporter interface (lines 809-840)
├── ObservabilityBridge interface (lines 845-860)
└── TraceState interface (lines 652-659)
```

### Core Implementation

```
observability/mastra/src/
├── instances/
│   ├── base.ts (BaseObservabilityInstance - 452 lines)
│   │   ├── startSpan() [lines 96-134]
│   │   ├── wireSpanLifecycle() [lines 198-226]
│   │   ├── emitSpanStarted/Updated/Ended() [lines 368-399]
│   │   ├── exportTracingEvent() [lines 404-418]
│   │   └── extractMetadataFromRequestContext() [lines 281-331]
│   └── default.ts (DefaultObservabilityInstance - 16 lines)
├── spans/
│   ├── base.ts (BaseSpan - 200 lines)
│   │   ├── createChildSpan() [lines 121-124]
│   │   ├── getParentSpanId() [lines 152-161]
│   │   └── exportSpan() [lines 178-195]
│   ├── default.ts (DefaultSpan - 187 lines)
│   │   ├── constructor with traceId assignment [lines 16-49]
│   │   └── end()/error()/update() methods [lines 51-122]
│   └── no-op.ts (NoOpSpan - 35 lines)
└── exporters/
    ├── base.ts (BaseExporter - 162 lines)
    │   └── exportTracingEvent() [lines 123-128]
    └── default.ts (DefaultExporter - 661 lines)
        ├── init() [lines 129-156]
        ├── _exportTracingEvent() [lines 613-636]
        └── flush() [lines 497-549]
```

## 2. Span Creation - Detailed Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent/Workflow Code Calls getOrCreateSpan()                              │
│ with: type, name, attributes, tracingContext, tracingOptions, etc.      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ getOrCreateSpan() [utils.ts:12-47]                                        │
│                                                                            │
│ if (tracingContext?.currentSpan) {                                        │
│   return tracingContext.currentSpan.createChildSpan({...})  ←─┐ CHILD    │
│ } else {                                                        │ SPAN    │
│   return getSelectedInstance().startSpan({...})  ←─────────┐   │         │
│ }                                                           │   │         │
└─────────────────────────────┬───────────────────────────────┼───┘         │
                              │                               │ ROOT SPAN    │
                              ▼                               ▼              │
        ┌─────────────────────────────────────────────────────────────┐    │
        │ Span<T> createChildSpan()                                   │    │
        │ [BaseSpan:121-124]                                          │    │
        │                                                              │    │
        │ return this.observabilityInstance.startSpan<TChildType>({  │    │
        │   ...options, parent: this, isEvent: false                 │    │
        │ })                                                          │    │
        └──────────────────┬──────────────────────────────────────────┘    │
                           │                                                │
        ┌──────────────────┴────────────────────────┬──────────────────────┘
        │                                            │
        ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BaseObservabilityInstance.startSpan() [base.ts:96-134]                  │
│                                                                          │
│ 1. shouldSample() ──→ false → return NoOpSpan()                        │
│                   ↓ true                                               │
│                                                                          │
│ 2. Determine TraceState:                                              │
│    if (options.parent) {                                              │
│      traceState = options.parent.traceState  ← INHERIT                │
│    } else {                                                            │
│      traceState = computeTraceState(tracingOptions)  ← NEW            │
│    }                                                                    │
│                                                                          │
│ 3. enrichedMetadata = extractMetadataFromRequestContext(              │
│      requestContext, metadata, traceState                             │
│    )                                                                    │
│                                                                          │
│ 4. span = createSpan({ ...rest, metadata: enrichedMetadata, ... })   │
│    (Concrete: DefaultSpan instance created here)                      │
│                                                                          │
│ 5. wireSpanLifecycle(span)  ← Wrap end()/update()                    │
│                                                                          │
│ 6. emitSpanStarted(span)    ← Send to exporters                       │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DefaultSpan Constructor [default.ts:16-49]                              │
│                                                                          │
│ this.id = generateSpanId()        ← 16 hex chars (64 bits)            │
│                                                                          │
│ TraceId Assignment Priority:                                           │
│ 1. if (options.parent) {                                              │
│      this.traceId = options.parent.traceId  ← INHERIT FROM PARENT    │
│    }                                                                    │
│ 2. else if (options.traceId && isValidTraceId(options.traceId)) {    │
│      this.traceId = options.traceId  ← USE PROVIDED                  │
│    }                                                                    │
│ 3. else {                                                              │
│      this.traceId = generateTraceId()  ← GENERATE NEW                │
│    }                                                                    │
│                                                                          │
│ ParentSpanId Assignment:                                               │
│ if (!options.parent && options.parentSpanId) {                        │
│   this.parentSpanId = options.parentSpanId  ← ROOT SPAN with PARENT  │
│ }                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Event Emission Flow

```
┌──────────────────────────────────────────────────────┐
│ Span Lifecycle: end() / update()                      │
└─────────────────────┬────────────────────────────────┘
                      │
                      │ WRAPPED by wireSpanLifecycle()
                      ▼
┌──────────────────────────────────────────────────────┐
│ emitSpanEnded() / emitSpanUpdated()                   │
│ [BaseObservabilityInstance:368-399]                  │
│                                                       │
│ 1. const exportedSpan = getSpanForExport(span)       │
│    - Check isValid (skip NoOpSpans)                  │
│    - Check isInternal && includeInternalSpans       │
│    - Process through spanOutputProcessors           │
│    - Call span.exportSpan()                          │
│                                                       │
│ 2. this.exportTracingEvent({                         │
│      type: TracingEventType.SPAN_ENDED,             │
│      exportedSpan                                    │
│    })                                                │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│ exportTracingEvent() [base.ts:404-418]               │
│                                                       │
│ for each exporter in this.exporters {               │
│   await exporter.exportTracingEvent(event)          │
│ }                                                     │
│ (Concurrent via Promise.allSettled)                 │
└─────────────────────┬────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌────────────────────────┐  ┌────────────────────────┐
│ Exporter 1             │  │ Exporter 2             │
│ exportTracingEvent()   │  │ exportTracingEvent()   │
│ (e.g., DefaultExporter)│  │ (e.g., OTelBridge)    │
└──────────┬─────────────┘  └──────────┬─────────────┘
           │                          │
           ▼                          ▼
   Store in Storage        Send to OpenTelemetry
   (batch-with-updates)    Collector
```

## 4. TraceId and ParentSpanId Inheritance

```
REQUEST 1: Root Agent Span
────────────────────────────────────────────
  Agent creates root span via getOrCreateSpan()
  ├─ tracingContext = undefined (no parent)
  ├─ tracingOptions = { traceId: undefined, parentSpanId: undefined }
  └─ Result: generateTraceId() → "a1b2c3d4..." (new 32 hex)

  │
  └─→ DefaultSpan constructor
      ├─ parent = undefined
      └─ traceId = generateTraceId() → "a1b2c3d4..."
      └─ parentSpanId = undefined
      └─ isRootSpan = true

REQUEST 2: Child Tool Span (child of Agent)
────────────────────────────────────────────
  Agent calls tool, passes tracingContext with current span

  Tool calls getOrCreateSpan()
  ├─ tracingContext.currentSpan = agent span (traceId: "a1b2c3d4...")
  └─ Result: currentSpan.createChildSpan()

  │
  └─→ BaseObservabilityInstance.startSpan()
      ├─ parent = agent span
      ├─ traceState = parent.traceState (inherited)
      └─ createSpan()

  │
  └─→ DefaultSpan constructor
      ├─ parent = agent span
      ├─ traceId = parent.traceId → "a1b2c3d4..." (INHERITED)
      ├─ parentSpanId = undefined (not used for children)
      └─ isRootSpan = false

REQUEST 3: Root Workflow Span with External Parent
────────────────────────────────────────────────────
  Incoming HTTP request with header:
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

  Caller extracts and passes:
  ├─ tracingOptions = {
  │    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  │    parentSpanId: "00f067aa0ba902b7"
  │  }
  └─ Result: Workflow span links to external trace

  │
  └─→ BaseObservabilityInstance.startSpan()
      └─ no parent (root span for Mastra)

  │
  └─→ DefaultSpan constructor
      ├─ parent = undefined
      ├─ traceId = options.traceId → "4bf92f3577b34da6a3ce929d0e0e4736" (PROVIDED)
      └─ parentSpanId = options.parentSpanId → "00f067aa0ba902b7" (PROVIDED)
      └─ isRootSpan = true (in Mastra's terms, but linked to external parent)
```

## 5. TraceState and Metadata Extraction

```
┌─────────────────────────────────────────────────────┐
│ Root Span Creation                                   │
│ tracingOptions.requestContextKeys = ["userId", "sessionId"] │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ computeTraceState(tracingOptions)                   │
│ [base.ts:262-276]                                    │
│                                                      │
│ configuredKeys = ["projectId"]  (from config)      │
│ additionalKeys = ["userId", "sessionId"]  (provided) │
│ allKeys = ["projectId", "userId", "sessionId"]     │
│                                                      │
│ TraceState = {                                      │
│   requestContextKeys: ["projectId", "userId",      │
│                        "sessionId"]                 │
│ }                                                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ extractMetadataFromRequestContext()                 │
│ [base.ts:281-331]                                    │
│                                                      │
│ RequestContext contains:                             │
│ ├─ projectId: "proj-123"                           │
│ ├─ userId: "user-456"                              │
│ ├─ sessionId: "sess-789"                           │
│ └─ internal: "hidden"                              │
│                                                      │
│ Extract based on traceState.requestContextKeys:    │
│ ├─ "projectId" → "proj-123" ✓                      │
│ ├─ "userId" → "user-456" ✓                         │
│ ├─ "sessionId" → "sess-789" ✓                      │
│ └─ "internal" → (skip, not in keys)                │
│                                                      │
│ Result metadata = {                                │
│   projectId: "proj-123",                           │
│   userId: "user-456",                              │
│   sessionId: "sess-789"                            │
│ }                                                    │
│                                                      │
│ (Supports dot notation: "user.id" extracts          │
│  nested value at requestContext.user.id)           │
└─────────────────────────────────────────────────────┘
```

## 6. ExportedSpan Structure

When a span is exported (via `span.exportSpan()`):

```typescript
ExportedSpan<AGENT_RUN> {
  // Identity
  id: "f8d3a1b2c3d4e5f6",        // 16 hex chars (span ID)
  traceId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  // 32 hex chars (trace ID)
  parentSpanId: "00f067aa0ba902b7",  // undefined for root spans

  // Lifecycle
  name: "agent run: 'myAgent'",
  type: SpanType.AGENT_RUN,
  startTime: Date(2025-01-15T10:30:00Z),
  endTime: Date(2025-01-15T10:30:05Z),     // undefined while running
  isEvent: false,
  isRootSpan: true,

  // Attributes (type-specific)
  attributes: {
    agentId: "myAgent",
    instructions: "You are helpful...",
    availableTools: ["tool1", "tool2"],
    maxSteps: 10
  },

  // Data
  metadata: {
    userId: "user-123",
    sessionId: "sess-456"
  },
  input: [
    { role: "user", content: "Hello" }
  ],
  output: [
    { role: "assistant", content: "Hi there!" }
  ],

  // Error Info
  errorInfo: undefined,  // or { message: "...", ... } if failed
}
```

## 7. Sampling Flow

```
startSpan() called
│
├─ shouldSample(customSamplerOptions)
│  [base.ts:235-257]
│
├─ Strategy: ALWAYS
│  └─ return true → Proceed
│
├─ Strategy: NEVER
│  └─ return false → Create NoOpSpan
│
├─ Strategy: RATIO (probability: 0.5)
│  ├─ Math.random() < 0.5
│  ├─ return true (50% chance) → Proceed
│  └─ return false (50% chance) → Create NoOpSpan
│
└─ Strategy: CUSTOM (sampler function)
   ├─ sampler(customSamplerOptions)
   ├─ return true → Proceed
   └─ return false → Create NoOpSpan

Result:
├─ Proceed → Create DefaultSpan + emit events + wire lifecycle
└─ NoOpSpan → No-op all methods, isValid = false, skip export
```

## 8. Span Lifecycle Wrapping

```
Original DefaultSpan Methods:
├─ end(options)
├─ update(options)
└─ error(options)

After wireSpanLifecycle():
├─ end() {
│  ├─ originalEnd(options)
│  └─ emitSpanEnded(span)  ← ADDED
│ }
├─ update() {
│  ├─ originalUpdate(options)
│  └─ emitSpanUpdated(span)  ← ADDED
│ }
└─ error() → unchanged

Why wrap?
├─ Decouple lifecycle from emission
├─ Consistent event flow regardless of implementation
└─ Plugin system gets all events automatically
```

## 9. Critical Points for OTEL Bridge Integration

### Point 1: Extract Trace Context from RequestContext

```typescript
// In getOrCreateSpan() or BaseObservabilityInstance.startSpan()
// BEFORE creating span, extract W3C context:

if (!options.tracingOptions?.traceId && requestContext) {
  const traceparent = requestContext.get('traceparent');
  // Parse W3C format: "00-traceId-spanId-flags"
  if (traceparent) {
    const [version, traceId, parentSpanId, flags] = traceparent.split('-');
    if (isValidTraceId(traceId)) {
      options.tracingOptions = {
        ...options.tracingOptions,
        traceId,
        parentSpanId,
      };
    }
  }
}
```

### Point 2: Implement OpenTelemetry Bridge Exporter

```typescript
// File: observability/otel-bridge/src/bridge.ts
export class OpenTelemetryBridge extends BaseExporter {
  name = 'otel-bridge';
  private tracer?: Tracer;

  init(options: InitExporterOptions) {
    // Initialize OpenTelemetry tracer
    this.tracer = trace.getTracer('@mastra/otel-bridge');
  }

  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const { exportedSpan } = event;

    // Convert Mastra span to OTEL span
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        // Create OTEL span context
        break;
      case TracingEventType.SPAN_ENDED:
        // Record span to OTEL exporter
        break;
    }
  }
}
```

### Point 3: Register Bridge as Exporter

```typescript
// In Mastra initialization
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new OpenTelemetryBridge({...}),
        ]
      }
    }
  }
});
```

## 10. Event Timeline Example

```
Timeline: Agent calls Tool
──────────────────────────────────

T0: Agent.generate() called with tracingOptions = { traceId: "abc..." }
    └─ getOrCreateSpan() → startSpan() → DefaultSpan created
    └─ id = "span1", traceId = "abc..."
    └─ emitSpanStarted() → Exporters receive TracingEvent
        └─ type: SPAN_STARTED
        └─ exportedSpan: { id: "span1", traceId: "abc...", ... }

T1: Agent processes, calls tool
    └─ getOrCreateSpan(tracingContext = {currentSpan: agentSpan})
    └─ currentSpan.createChildSpan() → startSpan() → DefaultSpan created
    └─ id = "span2", traceId = "abc..." (inherited from parent)
    └─ emitSpanStarted() → Exporters receive TracingEvent
        └─ type: SPAN_STARTED
        └─ exportedSpan: { id: "span2", traceId: "abc...", parentSpanId: "span1" }

T2: Tool completes
    └─ toolSpan.end() → emitSpanEnded()
    └─ Exporters receive TracingEvent
        └─ type: SPAN_ENDED
        └─ exportedSpan: { id: "span2", traceId: "abc...", endTime: T2 }

T3: Agent finishes
    └─ agentSpan.end() → emitSpanEnded()
    └─ Exporters receive TracingEvent
        └─ type: SPAN_ENDED
        └─ exportedSpan: { id: "span1", traceId: "abc...", endTime: T3 }

DefaultExporter batches and flushes:
├─ Batch 1: SPAN_STARTED events
├─ (optional) Batch 2: SPAN_UPDATED events if any
└─ Batch 3: SPAN_ENDED events

OpenTelemetryBridge:
└─ Receives same events, converts to OTEL format, sends to collector
```

## Key Implementation Takeaways

1. **TraceId Inheritance is Automatic**: Child spans inherit parent's traceId through `parent` reference
2. **No Manual Context Threading**: Parent/child relationship maintained through span references, not manual passing
3. **Event-Driven Export**: Exporters are decoupled from span implementation, receive events only
4. **Sampling Early Exit**: NoOpSpans created early, prevent unnecessary work
5. **RequestContext Optional**: Trace context can come from tracingOptions OR RequestContext extraction
6. **Bridge is Just Another Exporter**: OpenTelemetry bridge fits naturally into exporter plugin system
7. **Lifecycle Wrapping is Clever**: Wrap methods after creation ensures all implementations emit events
