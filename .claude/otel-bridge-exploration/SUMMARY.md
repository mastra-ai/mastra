# Mastra Observability System - Executive Summary

## Document Overview

This exploration provides comprehensive documentation of the Mastra observability architecture to support OpenTelemetry bridge implementation. Three documents provided:

1. **mastra_observability_architecture.md** - Deep architectural analysis (10 major sections)
2. **mastra_observability_code_flow.md** - Implementation details and integration guide (10 detailed flows)
3. **EXECUTIVE_SUMMARY.md** - This document

## 1-Minute Summary

Mastra's observability system creates OpenTelemetry-compatible spans with automatic traceId propagation through parent references. Spans emit events (STARTED, UPDATED, ENDED) that are routed to exporters including potential OpenTelemetry bridges. The system supports flexible context propagation via RequestContext, hierarchical span relationships, and sampling policies.

## Critical System Characteristics

### TraceId Assignment (AUTOMATIC)

- **Child spans**: Automatically inherit parent's traceId
- **Root spans**: Accept explicit traceId OR generate new one
- **Mechanism**: Direct parent reference (parent?: AnySpan)
- **Result**: All spans in a trace automatically share same traceId without manual threading

### Context Propagation (FLEXIBLE)

- **RequestContext**: Type-safe, scoped context container
- **TracingOptions**: Explicit traceId/parentSpanId passing
- **TraceState**: Merged configuration keys for metadata extraction
- **Current Gap**: No automatic W3C trace context extraction from incoming requests

### Span Lifecycle (EVENT-DRIVEN)

- **Create**: generateSpanId() (16 hex) + assign traceId (32 hex)
- **Emit Started**: Immediately after creation + wiring
- **Update**: Changes tracked and emitted
- **End**: Final update emitted, span closed
- **Export**: Three event types sent to all exporters concurrently

### Exporter System (PLUGIN-BASED)

- **BaseExporter**: Abstract base for all exporters
- **Interface**: init(), \_\_setLogger(), exportTracingEvent(), shutdown()
- **Event Reception**: Three types (SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED)
- **Flow**: Events emitted → All exporters called → Promise.allSettled() waits
- **Storage**: DefaultExporter handles persistence with 3 strategies (realtime, batch-with-updates, insert-only)

## Key Implementation Files

### Type System (Core Contracts)

```
packages/core/src/observability/types/tracing.ts - 438 lines
├─ SpanType enum (18 types covering agents, workflows, models, tools)
├─ ObservabilityInstance interface
├─ Span<T> generic interface (lifecycle methods)
├─ ExportedSpan<T> for export
├─ TracingEvent union type
├─ ObservabilityExporter interface
└─ ObservabilityBridge interface (NEW - for OTEL)
```

### Span Management (1,074 lines total)

```
observability/mastra/src/instances/base.ts - 452 lines
├─ startSpan() method [96-134]
│  ├─ Sampling decision
│  ├─ TraceState computation/inheritance
│  ├─ RequestContext metadata extraction
│  ├─ Span creation
│  └─ Lifecycle wiring + event emission
├─ wireSpanLifecycle() [198-226]
├─ emitSpanStarted/Updated/Ended() [368-399]
└─ exportTracingEvent() [404-418]

observability/mastra/src/spans/default.ts - 187 lines
├─ Constructor traceId assignment [16-49]
│  ├─ Inherit from parent.traceId if child
│  ├─ Use provided traceId if valid
│  ├─ Generate new if root
│  └─ Set parentSpanId if provided
├─ end() [51-66]
├─ update() [104-122]
└─ error() [68-102]

observability/mastra/src/spans/base.ts - 200 lines
├─ getParentSpanId() [152-161]
├─ exportSpan() [178-195]
└─ createChildSpan() [121-124]
```

### Exporter System (823 lines total)

```
observability/mastra/src/exporters/base.ts - 162 lines
├─ Abstract base for all exporters
├─ exportTracingEvent() [123-128]
└─ Disable mechanism for misconfiguration

observability/mastra/src/exporters/default.ts - 661 lines
├─ Three strategies support
├─ init() strategy resolution
├─ _exportTracingEvent() [613-636]
├─ Buffer management
├─ Batch flushing with retries
└─ Storage integration
```

### Registry (118 lines)

```
observability/mastra/src/registry.ts
├─ Instance registration/unregistration
├─ Default instance tracking
├─ Config selector function
└─ Selector-based instance retrieval
```

## Span Flow: From Creation to Export

```
1. getOrCreateSpan() [utils.ts]
   ↓
   ├─→ tracingContext.currentSpan exists?
   │   └─→ createChildSpan() → startSpan(parent=this)
   └─→ no current span?
       └─→ getSelectedInstance() → startSpan()

2. BaseObservabilityInstance.startSpan() [instances/base.ts:96-134]
   ├─ shouldSample() → return NoOpSpan if false
   ├─ Determine TraceState (inherit or compute)
   ├─ Extract metadata from RequestContext
   ├─ Call createSpan() → DefaultSpan() instantiation
   ├─ wireSpanLifecycle()
   └─ emitSpanStarted()

3. DefaultSpan Constructor [spans/default.ts:16-49]
   ├─ generateSpanId() → 16 hex chars
   ├─ Assign traceId:
   │  ├─ parent.traceId if child
   │  ├─ options.traceId if provided and valid
   │  └─ generateTraceId() otherwise
   └─ Store parentSpanId if provided

4. Event Emission Chain [base.ts:368-418]
   ├─ emitSpanStarted/Updated/Ended()
   ├─ getSpanForExport() filtering
   ├─ exportTracingEvent()
   └─ Each exporter receives TracingEvent
       ├─ DefaultExporter: Buffer and persist
       └─ OpenTelemetryBridge: Send to collector
```

## Data Structures Exported

### ExportedSpan (What Exporters Receive)

```
{
  id: "f8d3a1b2c3d4e5f6",                    // Span ID (16 hex)
  traceId: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6", // Trace ID (32 hex)
  parentSpanId?: "00f067aa0ba902b7",         // Parent span or undefined
  name: "agent run: 'myAgent'",
  type: SpanType.AGENT_RUN,
  startTime: Date,
  endTime?: Date,
  isEvent: boolean,
  isRootSpan: boolean,
  attributes: { agentId, instructions, ... },  // Type-specific
  metadata: { userId, sessionId, ... },       // Extracted from RequestContext
  input: any,
  output: any,
  errorInfo?: { message, id, domain, ... }
}
```

### TracingEvent (What Exporters Receive)

```
{
  type: TracingEventType.SPAN_STARTED | SPAN_UPDATED | SPAN_ENDED,
  exportedSpan: ExportedSpan<T>
}
```

## Critical Integration Points for OpenTelemetry Bridge

### 1. Trace Context Extraction (NEEDED)

**Current State**: Mastra does NOT automatically extract W3C trace context
**Solution Location**: `getOrCreateSpan()` or `BaseObservabilityInstance.startSpan()`
**Action**: Extract traceparent from RequestContext, parse, inject into tracingOptions.traceId/parentSpanId

### 2. Bridge Registration (STRAIGHTFORWARD)

**Pattern**: Implement ObservabilityBridge interface (same as ObservabilityExporter)
**Methods**: init(), \_\_setLogger(), exportTracingEvent(), shutdown()
**Registration**: Add to observability.exporters array in Mastra config

### 3. Event Handling (CONSISTENT)

**Events**: Same three event types as other exporters
**Data**: ExportedSpan with all necessary fields
**Pattern**: Convert Mastra span to OpenTelemetry span, record to SDK

### 4. Sampling Interaction (TRANSPARENT)

**Current**: Sampling handled by BaseObservabilityInstance
**Result**: Bridge only receives sampled spans (NoOpSpans filtered before export)
**Benefit**: Bridge doesn't need to implement sampling logic

## No-Op Span Pattern

**Purpose**: Prevent memory allocation when tracing disabled
**Creation**: When shouldSample() returns false
**Characteristics**:

- All lifecycle methods no-op
- isValid = false (filtered from export)
- No events emitted
- Minimal memory footprint

## RequestContext System

**Type-Safe Context Container**:

```typescript
class RequestContext<Values extends Record<string, any>> {
  registry = Map<string, unknown>;
  set<K>(key: K, value: any): void;
  get<K>(key: K): unknown;
}
```

**Usage in Observability**:

1. RequestContext created at request boundary
2. Passed through execution chain
3. At root span creation:
   - TraceState computed with configured keys
   - Metadata extracted using dot notation support
   - Merged with explicit metadata

**Dot Notation Support**: "user.id", "session.data.experimentId"

## Sampling Strategies

**Four Options**:

1. ALWAYS: All spans sampled
2. NEVER: No spans sampled
3. RATIO: Sample with probability (0-1)
4. CUSTOM: Custom sampler function

**Applied At**: startSpan() entry point (line 99 of base.ts)

## Metadata Extraction Flow

```
TracingOptions + RequestContext
├─ tracingOptions.requestContextKeys = ["userId", "sessionId"]
├─ config.requestContextKeys = ["projectId"]
└─ Merged: ["projectId", "userId", "sessionId"]

For each key in merged list:
├─ Extract from RequestContext
├─ Support dot notation navigation
└─ Build metadata object

Result: Metadata available on all spans in trace
```

## Three Exporter Persistence Strategies

### 1. Realtime

- Each event immediately persisted
- storage.createSpan() or storage.updateSpan()
- No buffering, no retries

### 2. Batch-with-Updates

- Events buffered in memory
- SPAN_STARTED → createSpan()
- SPAN_UPDATED/ENDED → updateSpan()
- Batches flushed by size (1000) or time (5000ms)
- Exponential backoff retry logic
- Default strategy

### 3. Insert-Only

- Only SPAN_ENDED events processed
- Creates final span state on end
- Simplest for write-optimized storage
- storage.batchCreateSpans()

## Lifecycle Wrapping Technique

**Why**: Decouple lifecycle from emission, ensure consistency
**When**: After span creation, before first use
**Method**: Store original methods, replace with wrapped versions

```typescript
span.end = options => {
  originalEnd(options);
  emitSpanEnded(span); // ← ADDED
};
```

## Inheritance Chain for Custom Span Implementations

```
BaseSpan (abstract)
├─ Common interface implementation
├─ Parent chain walking
├─ Export logic
└─ Child span creation

DefaultSpan extends BaseSpan
├─ TraceId assignment logic
├─ Lifecycle method implementations
└─ Real span for production use

NoOpSpan extends BaseSpan
├─ All methods no-op
├─ Used when sampling=false
└─ Filtered from export
```

## Configuration Structure

```typescript
ObservabilityInstanceConfig {
  name: string                              // Unique identifier
  serviceName: string                       // For exporters
  sampling?: SamplingStrategy              // Default: ALWAYS
  exporters?: ObservabilityExporter[]      // Default: []
  spanOutputProcessors?: SpanOutputProcessor[]  // Default: []
  includeInternalSpans?: boolean           // Default: false
  requestContextKeys?: string[]            // Default: []
}
```

## Key Properties of Spans

```
Read-Only During Lifecycle:
- id: Unique span identifier
- traceId: Shared trace identifier
- type: SpanType enum
- startTime: When span was created
- parent?: AnySpan reference
- isEvent: Event-type span flag
- isInternal: Internal operation flag

Mutable During Lifecycle:
- endTime: Set by end()
- output: Set by end()
- attributes: Updated by update()/error()
- metadata: Updated by update()/error()
- errorInfo: Set by error()

Computed at Export:
- parentSpanId: Calculated via getParentSpanId()
- isRootSpan: Computed from parent === undefined
```

## Memory Management

- **Parent References**: Objects with parent links held until span context exits
- **Span Lifetime**: From creation through end() + export
- **Completed Span Cleanup**: DefaultExporter tracks completed spans, removes from memory after flush
- **No-Op Spans**: Minimal memory footprint, created but immediately eligible for GC

## Test Coverage

- **span-base.test.ts**: BaseSpan functionality
- **default.test.ts**: DefaultExporter batching
- **console.test.ts**: Console exporter
- **cloud.test.ts**: Mastra Cloud exporter
- **registry.test.ts**: Instance registry
- **tracing.test.ts**: Integration tests

## Summary for Bridge Implementation

To implement an OpenTelemetry bridge:

1. **Extend BaseExporter**

   ```typescript
   export class OpenTelemetryBridge extends BaseExporter {
     name = 'otel-bridge'
     async _exportTracingEvent(event: TracingEvent) { ... }
   }
   ```

2. **Handle Three Event Types**
   - SPAN_STARTED: Initialize span context
   - SPAN_UPDATED: Record updates
   - SPAN_ENDED: Record final span

3. **Convert Mastra Span to OTEL**
   - Use exportedSpan.id as spanId
   - Use exportedSpan.traceId as traceId
   - Use exportedSpan.parentSpanId as parentSpanId
   - Map SpanType to OTEL span kind
   - Map attributes/metadata to OTEL attributes

4. **Register with Mastra**

   ```typescript
   exporters: [new OpenTelemetryBridge()];
   ```

5. **Optional: Extract W3C Context**
   - Add to getOrCreateSpan() or startSpan()
   - Parse W3C traceparent header
   - Inject into tracingOptions

## Files for Implementation

**To Read**:

1. `/packages/core/src/observability/types/tracing.ts` - Type system
2. `/observability/mastra/src/instances/base.ts` - Core logic
3. `/observability/mastra/src/spans/default.ts` - Span implementation
4. `/observability/mastra/src/exporters/base.ts` - Exporter base

**To Use as Template**:

1. `/observability/mastra/src/exporters/default.ts` - Full implementation example

**To Modify for W3C Extraction**:

1. `/packages/core/src/observability/utils.ts` - getOrCreateSpan()

**To Extend**:

1. Create `/observability/otel-bridge/src/bridge.ts`

## Architecture Strengths

1. **Type Safety**: Full TypeScript generics for SpanType mapping
2. **Flexibility**: Pluggable exporters, processors, samplers
3. **Decoupling**: Event-based export independent of span implementation
4. **Hierarchical**: Parent-child relationships through object references
5. **Performance**: Early sampling avoids unnecessary work
6. **Extensibility**: Bridge pattern allows custom implementations
7. **Context**: RequestContext provides flexible metadata extraction
8. **Lifecycle**: Automatic event emission via method wrapping

## Potential Enhancements for Bridge

1. **Automatic W3C Extraction**: Parse traceparent from RequestContext headers
2. **OTEL SDK Integration**: Native OpenTelemetry SDKs for metrics/logs
3. **W3C Propagation Export**: Add traceparent to outgoing requests
4. **Custom Span Processor**: Convert Mastra attributes to OTEL semantic conventions
5. **Baggage Support**: Propagate OTEL baggage through RequestContext
